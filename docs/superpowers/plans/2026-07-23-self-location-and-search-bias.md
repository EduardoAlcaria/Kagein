# Self-Location Tracking & Proximity-Biased Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the logged-in operator share their own browser location (persisted as a "Me" person, evaluated for zone alerts) and bias the map's address search toward that location, Google-Maps style.

**Architecture:** One frontend geolocation hook (`useMyLocation`, opt-in, 60s periodic) feeds two consumers: a `POST /api/me/location` mutation that upserts a `self` person + location and runs zone alerts, and the `MapPanel` Nominatim search which adds a `viewbox` around the operator's coords. Backend mirrors the existing `PointController` single-account pattern.

**Tech Stack:** Spring Boot 4 (Java 21), JPA, Testcontainers + MockMvc; React 18 + TypeScript, @tanstack/react-query, Vitest + Testing Library + MSW.

## Global Constraints

- One file change = one commit = one push. Each changed file is its own commit; push after each. No AI attribution / no `Co-Authored-By` in commit messages.
- Spring Boot 4 test import packages: `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc`. Jackson 3 base package is `tools.jackson.databind` (not `com.fasterxml.jackson`) — not needed here but do not reintroduce Jackson 2 imports.
- Controller integration tests share one Testcontainer across the class; wipe rows in `@BeforeEach` to avoid `apple_id` unique-constraint collisions.
- The app is single-tenant: self-tracking attaches to the first `fm_account`; `409 CONFLICT` if none.
- Full spec: `docs/superpowers/specs/2026-07-23-self-location-and-search-bias-design.md`.

---

## Task 1: Backend `MeController` — persist the operator's location

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/me/UpdateMyLocationRequest.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/me/MeController.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/me/MeControllerTest.java`

**Interfaces:**
- Consumes: `FmAccountRepository.findAll()`, `PersonRepository.findByFmAccountIdAndExternalId(Long, String)`, `PersonRepository.save(Person)`, `PersonLocationRepository.save(PersonLocation)`, `ZoneAlertService.checkAccount(FmAccount)` (all existing).
- Produces: REST `POST /api/me/location` with body `{ latitude, longitude }`, responds `204 No Content`; `409` when no account exists; `400` when a coordinate is missing. Self person has `externalId="self"`, `name="Me"`.

- [ ] **Step 1: Write the request record**

```java
// spring-bff/src/main/java/com/kagein/springbff/me/UpdateMyLocationRequest.java
package com.kagein.springbff.me;

public record UpdateMyLocationRequest(Double latitude, Double longitude) {
}
```

- [ ] **Step 2: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/me/MeControllerTest.java
package com.kagein.springbff.me;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class MeControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired private MockMvc mockMvc;
    @Autowired private FmAccountRepository fmAccountRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private PersonLocationRepository personLocationRepository;

    @BeforeEach
    void clean() {
        personLocationRepository.deleteAll();
        personRepository.deleteAll();
        fmAccountRepository.deleteAll();
    }

    private Long seedAccount() {
        return fmAccountRepository.save(FmAccount.builder().appleId("a@icloud.com")
                .encryptedPassword("x").status(AccountStatus.ACTIVE).createdAt(Instant.now()).build()).getId();
    }

    @Test
    void createsSelfPersonAndLocation() throws Exception {
        Long accountId = seedAccount();

        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isNoContent());

        var self = personRepository.findByFmAccountIdAndExternalId(accountId, "self");
        assertThat(self).isPresent();
        assertThat(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(self.get().getId())).hasSize(1);
    }

    @Test
    void reusesSelfPersonOnSecondUpdate() throws Exception {
        Long accountId = seedAccount();

        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.57,\"longitude\":-46.64}"))
                .andExpect(status().isNoContent());

        assertThat(personRepository.findAll()).hasSize(1);
        Long selfId = personRepository.findByFmAccountIdAndExternalId(accountId, "self").get().getId();
        assertThat(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(selfId)).hasSize(2);
    }

    @Test
    void conflictsWhenNoAccount() throws Exception {
        mockMvc.perform(post("/api/me/location").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isConflict());
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd spring-bff && sh mvnw -Dtest=MeControllerTest test`
Expected: FAIL — `MeController` does not exist (404 / no bean).

- [ ] **Step 4: Implement the controller**

```java
// spring-bff/src/main/java/com/kagein/springbff/me/MeController.java
package com.kagein.springbff.me;

import com.kagein.springbff.alert.ZoneAlertService;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.Person;
import com.kagein.springbff.domain.PersonLocation;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PersonLocationRepository;
import com.kagein.springbff.repository.PersonRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private static final String SELF_EXTERNAL_ID = "self";
    private static final String SELF_NAME = "Me";

    private final FmAccountRepository fmAccountRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;
    private final ZoneAlertService zoneAlertService;

    public MeController(
            FmAccountRepository fmAccountRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository,
            ZoneAlertService zoneAlertService) {
        this.fmAccountRepository = fmAccountRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
        this.zoneAlertService = zoneAlertService;
    }

    @PostMapping("/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateLocation(@RequestBody UpdateMyLocationRequest request) {
        if (request.latitude() == null || request.longitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "latitude and longitude required");
        }
        FmAccount account = fmAccountRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "no account configured"));
        Person self = personRepository.findByFmAccountIdAndExternalId(account.getId(), SELF_EXTERNAL_ID)
                .orElseGet(() -> personRepository.save(Person.builder()
                        .fmAccountId(account.getId())
                        .externalId(SELF_EXTERNAL_ID)
                        .name(SELF_NAME)
                        .build()));
        personLocationRepository.save(PersonLocation.builder()
                .personId(self.getId())
                .latitude(request.latitude())
                .longitude(request.longitude())
                .capturedAt(Instant.now())
                .build());
        zoneAlertService.checkAccount(account);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd spring-bff && sh mvnw -Dtest=MeControllerTest test`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit (one file per commit)**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/me/UpdateMyLocationRequest.java && git commit -m "Add UpdateMyLocationRequest" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/me/MeController.java && git commit -m "Add MeController to persist operator location" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/me/MeControllerTest.java && git commit -m "Test operator location upsert and no-account conflict" -q && git push -q
```

---

## Task 2: Frontend API client — `updateMyLocation`

**Files:**
- Modify: `react-frontend/src/api/client.ts`

**Interfaces:**
- Consumes: `authFetch` (existing).
- Produces: `updateMyLocation(coords: { latitude: number; longitude: number }): Promise<void>` issuing `POST /api/me/location`.

- [ ] **Step 1: Add the client function**

Append to `react-frontend/src/api/client.ts` (below `deleteZone`):

```ts
export async function updateMyLocation(coords: { latitude: number; longitude: number }): Promise<void> {
  await authFetch('/api/me/location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coords),
  });
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd react-frontend && npm run build`
Expected: PASS — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add react-frontend/src/api/client.ts && git commit -m "Add updateMyLocation API client call" -q && git push -q
```

---

## Task 3: Frontend `useMyLocation` hook + `useUpdateMyLocation` mutation

**Files:**
- Create: `react-frontend/src/hooks/useMyLocation.ts`
- Create: `react-frontend/src/hooks/useMyLocation.test.tsx`

**Interfaces:**
- Consumes: `updateMyLocation` (Task 2), `navigator.geolocation`.
- Produces: `type MyLocationCoords = { latitude: number; longitude: number }`; `type GeoStatus = 'idle' | 'granted' | 'denied'`; `useMyLocation(enabled: boolean): { coords: MyLocationCoords | null; status: GeoStatus }` capturing a fix on mount and every 60s while enabled; `useUpdateMyLocation()` react-query mutation posting a `MyLocationCoords`.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/hooks/useMyLocation.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyLocation } from './useMyLocation';

describe('useMyLocation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('captures a fix on mount and again after 60s when enabled', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: -23.56, longitude: -46.65 } } as GeolocationPosition),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const { result } = renderHook(() => useMyLocation(true));

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current.coords).toEqual({ latitude: -23.56, longitude: -46.65 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('reports denied and null coords when permission is refused', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) =>
        error({ code: 1, message: 'denied' } as GeolocationPositionError),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const { result } = renderHook(() => useMyLocation(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.coords).toBeNull();
  });

  it('stays idle and never polls when disabled', () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    const { result } = renderHook(() => useMyLocation(false));

    expect(result.current.status).toBe('idle');
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- useMyLocation`
Expected: FAIL — `useMyLocation` does not exist.

- [ ] **Step 3: Implement the hook**

```ts
// react-frontend/src/hooks/useMyLocation.ts
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateMyLocation } from '../api/client';

export type MyLocationCoords = { latitude: number; longitude: number };
export type GeoStatus = 'idle' | 'granted' | 'denied';

const POLL_MS = 60_000;

export function useMyLocation(enabled: boolean): { coords: MyLocationCoords | null; status: GeoStatus } {
  const [coords, setCoords] = useState<MyLocationCoords | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(null);
      setStatus('idle');
      return;
    }
    const capture = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setStatus('granted');
        },
        () => {
          setCoords(null);
          setStatus('denied');
        },
      );
    };
    capture();
    const timer = setInterval(capture, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  return { coords, status };
}

export function useUpdateMyLocation() {
  return useMutation({ mutationFn: (coords: MyLocationCoords) => updateMyLocation(coords) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd react-frontend && npm run test -- useMyLocation`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/hooks/useMyLocation.ts && git commit -m "Add useMyLocation geolocation hook and update mutation" -q && git push -q
git add react-frontend/src/hooks/useMyLocation.test.tsx && git commit -m "Test useMyLocation capture, denied, and disabled paths" -q && git push -q
```

---

## Task 4: `SelfTrackingToggle` component

**Files:**
- Create: `react-frontend/src/components/SelfTrackingToggle.tsx`
- Create: `react-frontend/src/components/SelfTrackingToggle.test.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/button`), `GeoStatus` (Task 3).
- Produces: `SelfTrackingToggle({ enabled, status, onToggle }: { enabled: boolean; status: GeoStatus; onToggle: (next: boolean) => void })` — a button toggling share state and a denied-permission hint.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/SelfTrackingToggle.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelfTrackingToggle } from './SelfTrackingToggle';

describe('SelfTrackingToggle', () => {
  it('invokes onToggle with the next state when clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<SelfTrackingToggle enabled={false} status="idle" onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Share my location' }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('shows a denied hint when enabled but permission is denied', () => {
    render(<SelfTrackingToggle enabled status="denied" onToggle={vi.fn()} />);

    expect(screen.getByText('Location permission denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop sharing my location' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- SelfTrackingToggle`
Expected: FAIL — `SelfTrackingToggle` does not exist.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/SelfTrackingToggle.tsx
import { Button } from './ui/button';
import type { GeoStatus } from '../hooks/useMyLocation';

interface SelfTrackingToggleProps {
  enabled: boolean;
  status: GeoStatus;
  onToggle: (next: boolean) => void;
}

export function SelfTrackingToggle({ enabled, status, onToggle }: SelfTrackingToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={enabled ? 'default' : 'outline'}
        onClick={() => onToggle(!enabled)}
      >
        {enabled ? 'Stop sharing my location' : 'Share my location'}
      </Button>
      {enabled && status === 'denied' && (
        <span className="text-xs text-destructive">Location permission denied</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd react-frontend && npm run test -- SelfTrackingToggle`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/SelfTrackingToggle.tsx && git commit -m "Add SelfTrackingToggle component" -q && git push -q
git add react-frontend/src/components/SelfTrackingToggle.test.tsx && git commit -m "Test SelfTrackingToggle toggle and denied hint" -q && git push -q
```

---

## Task 5: `MapPanel` proximity-biased search

**Files:**
- Modify: `react-frontend/src/components/MapPanel.tsx`
- Modify: `react-frontend/src/components/MapPanel.test.tsx`

**Interfaces:**
- Consumes: `MyLocationCoords` shape `{ latitude, longitude }` (Task 3), passed as a new optional prop.
- Produces: `MapPanel` gains prop `searchCenter?: { latitude: number; longitude: number } | null`. When present, the Nominatim request appends `&viewbox=lonMin,latMin,lonMax,latMax&bounded=0` (±0.15° box); when absent the request is unchanged.

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe('MapPanel', ...)` in `react-frontend/src/components/MapPanel.test.tsx` (the file already imports `TestQueryProvider`, `vi`, `render`, `screen`, `userEvent`):

```tsx
  it('biases the search viewbox toward searchCenter when provided', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ display_name: 'Nearby Place', lat: '-23.5', lon: '-46.6' }])),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <MapPanel
          people={[]}
          selectedPersonId={null}
          onSelectPerson={vi.fn()}
          trail={[]}
          searchCenter={{ latitude: -23.56, longitude: -46.65 }}
        />
      </TestQueryProvider>,
    );

    await user.type(screen.getByLabelText('Search address'), 'Cafe');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('viewbox=');
    expect(calledUrl).toContain('bounded=0');

    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- MapPanel`
Expected: FAIL — `MapPanel` has no `searchCenter` prop (TypeScript error) / no `viewbox` in URL.

- [ ] **Step 3: Implement**

In `react-frontend/src/components/MapPanel.tsx`, extend the props type and destructuring:

```tsx
interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
  zones?: ZoneRenderable[];
  searchCenter?: { latitude: number; longitude: number } | null;
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail, zones, searchCenter }: MapPanelProps) {
```

Replace the `fetch` call inside `handleSearch` (currently `const response = await fetch(...single line...)`) with a viewbox-aware URL:

```tsx
      const base = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
      const url = searchCenter
        ? `${base}&viewbox=${searchCenter.longitude - 0.15},${searchCenter.latitude - 0.15},` +
          `${searchCenter.longitude + 0.15},${searchCenter.latitude + 0.15}&bounded=0`
        : base;
      const response = await fetch(url);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test -- MapPanel`
Expected: PASS — new viewbox test plus the existing MapPanel tests (which pass no `searchCenter`, so their URLs stay unbiased).

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/MapPanel.tsx && git commit -m "Bias address search toward operator location" -q && git push -q
git add react-frontend/src/components/MapPanel.test.tsx && git commit -m "Test search viewbox bias from searchCenter" -q && git push -q
```

---

## Task 6: Wire self-tracking + search bias into `DashboardPage`

**Files:**
- Modify: `react-frontend/src/pages/DashboardPage.tsx`
- Create: `react-frontend/src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `useMyLocation`/`useUpdateMyLocation` (Task 3), `SelfTrackingToggle` (Task 4), `MapPanel.searchCenter` (Task 5).
- Produces: dashboard holds a `shareLocation` boolean persisted in `localStorage` under `findmy.shareLocation`; renders `SelfTrackingToggle` in the map panel's action slot; POSTs each captured fix; passes `searchCenter={coords}` to `MapPanel`.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/pages/DashboardPage.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestQueryProvider } from '../test/queryClient';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('renders the share-my-location toggle', async () => {
    render(
      <TestQueryProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </TestQueryProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Share my location' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- DashboardPage`
Expected: FAIL — no "Share my location" button rendered.

- [ ] **Step 3: Implement the wiring**

In `react-frontend/src/pages/DashboardPage.tsx`:

Add imports below the existing hook imports:

```tsx
import { useEffect, useState } from 'react';
import { useMyLocation, useUpdateMyLocation } from '../hooks/useMyLocation';
import { SelfTrackingToggle } from '../components/SelfTrackingToggle';
```

(`useState` is already imported from `react`; merge the `useEffect` in rather than duplicating the import line.)

Inside the component, after the existing `usePoints()` line, add the self-location state and effect:

```tsx
  const [shareLocation, setShareLocation] = useState<boolean>(
    () => localStorage.getItem('findmy.shareLocation') === 'true',
  );
  const { coords: myCoords, status: geoStatus } = useMyLocation(shareLocation);
  const updateMyLocation = useUpdateMyLocation();

  function toggleShareLocation(next: boolean) {
    setShareLocation(next);
    localStorage.setItem('findmy.shareLocation', String(next));
  }

  useEffect(() => {
    if (shareLocation && myCoords) {
      updateMyLocation.mutate(myCoords);
    }
    // updateMyLocation identity is stable across renders; posting keys off a fresh coords object each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareLocation, myCoords]);
```

Render the toggle in the map `PanelCard`'s `action` slot — replace the existing `action={ selectedPerson ? (...) : (...) }` expression with one that also shows the toggle:

```tsx
          action={
            <div className="flex items-center gap-3">
              <SelfTrackingToggle enabled={shareLocation} status={geoStatus} onToggle={toggleShareLocation} />
              {selectedPerson ? (
                <span className="font-mono text-xs text-muted-foreground">
                  tracking {selectedPerson.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Select a person to see their trail</span>
              )}
            </div>
          }
```

Pass `searchCenter` to the map — update the `<MapPanel .../>` call to add the prop:

```tsx
            <MapPanel
              people={allPeople}
              selectedPersonId={selectedPersonId}
              onSelectPerson={setSelectedPersonId}
              trail={locations ?? []}
              zones={zoneRenderables}
              searchCenter={myCoords}
            />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd react-frontend && npm run test -- DashboardPage`
Expected: PASS. (`navigator.geolocation` is undefined in jsdom, so `useMyLocation` stays idle — the toggle still renders.)

- [ ] **Step 5: Full frontend suite + build**

Run: `cd react-frontend && npm run test -- --run && npm run build`
Expected: PASS — all frontend tests green, clean build.

- [ ] **Step 6: Commit**

```bash
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire self-location sharing and search bias into dashboard" -q && git push -q
git add react-frontend/src/pages/DashboardPage.test.tsx && git commit -m "Test dashboard renders share-location toggle" -q && git push -q
```

---

## Done criteria

1. `cd spring-bff && sh mvnw test` passes (adds `MeControllerTest`).
2. `cd react-frontend && npm run test -- --run` passes and `npm run build` is clean.
3. `docker compose up --build`, log in: enable "Share my location", accept the browser prompt → a live person "Me" appears on the map and in the people list; a zone drawn around your position fires an `INSIDE`/`ENTER` alert.
4. With sharing on, the address search returns nearby results first (request carries `viewbox`/`bounded=0`); with sharing off, search is global as before.

## Notes for the implementer

- `useMyLocation` deliberately polls every 60s rather than using `watchPosition`, to cap HTTP/battery overhead (spec decision).
- Self-tracking requires a connected `fm_account`; without one the POST returns `409` and the operator should connect an account in Settings first.
- Distinct "Me" marker styling is out of scope; the operator renders as a normal live person.
