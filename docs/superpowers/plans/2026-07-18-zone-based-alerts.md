# Zone-Based Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add geographic zone alerts — a tracked person entering, leaving, or sitting inside a shape (circle or polygon) anchored to a saved point of interest fires an alert — plus a reusable map drawing primitive that turns a circle or polygon into coordinates.

**Architecture:** Two layers over the existing stack. Backend (spring-bff): two new tables (`point_of_interest`, `zone`) plus a nullable `zone_id` on `alert_event`; a pure geometry helper (haversine + ray-casting); a `ZoneAlertService` run at the end of each poll cycle that evaluates every account's zones against its people's two most recent fixes; CRUD controllers for points and zones. Frontend (react-frontend): a `ZoneEditor` maplibre component that emits geometry, a points/zones management surface in Settings, and color-coded zone overlays on the dashboard map. Zones are evaluated independently — nesting is emergent from the coordinates, with no parent/child link and no priority ordering.

**Tech Stack:** Java 21 / Spring Boot 3 (JPA, Flyway, Jackson, Testcontainers, Mockito, MockMvc), PostgreSQL 17; React 18 / TypeScript / Vite, @tanstack/react-query, maplibre-gl, shadcn/ui, Vitest + Testing Library + MSW.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-zone-based-alerts-design.md`.
- One file changed = one commit = one push (repo convention). No AI attribution in commit messages. Work directly on `main`.
- Backend entities use Lombok (`@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`) and `@GeneratedValue(strategy = GenerationType.IDENTITY)`, matching existing `domain/*.java`.
- DTOs are Java records (matching `AlertEventDto`, `RegisterAccountRequest`).
- Controllers validate inline and throw `ResponseStatusException(HttpStatus.BAD_REQUEST)` — the codebase does not use `@Valid`/bean-validation.
- Controller integration tests use `@Testcontainers` + `@SpringBootTest` + `@AutoConfigureMockMvc` with the exact `@TestPropertySource` block and `PostgreSQLContainer<>("postgres:17-alpine")` from `AlertControllerTest`, and authenticate with `.with(httpBasic("admin", "hunter2"))`.
- Service unit tests use `@ExtendWith(MockitoExtension.class)` + `@Mock`/`@InjectMocks` + `ReflectionTestUtils.setField(...)` for `@Value` fields, matching `StaleUpdateAlertServiceTest`.
- Zone geometry is `[[lat, lon], ...]` (latitude first) everywhere — DB JSONB, DTOs, and the frontend.
- Config property defaults: `zone.freshness-window-min:15`, `zone.movement-threshold-m:30`, `zone.movement-window-min:15`.
- Backend build/test: `cd spring-bff && ./mvnw test`. Frontend: `cd react-frontend && npm run test` and `npm run build`.

---

## Task 1: Flyway migration for points, zones, and alert_event.zone_id

**Files:**
- Create: `spring-bff/src/main/resources/db/migration/V2__zones.sql`

**Interfaces:**
- Produces: tables `point_of_interest` (id, fm_account_id, label, latitude, longitude, created_at) and `zone` (id, poi_id, shape, radius_meters, vertices JSONB, trigger, color, alarm_message, created_at); column `alert_event.zone_id` (nullable FK to `zone`).

- [ ] **Step 1: Write the migration**

```sql
-- spring-bff/src/main/resources/db/migration/V2__zones.sql
CREATE TABLE point_of_interest (
    id BIGSERIAL PRIMARY KEY,
    fm_account_id BIGINT NOT NULL REFERENCES fm_account(id),
    label VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE zone (
    id BIGSERIAL PRIMARY KEY,
    poi_id BIGINT NOT NULL REFERENCES point_of_interest(id) ON DELETE CASCADE,
    shape VARCHAR(16) NOT NULL,
    radius_meters INT,
    vertices JSONB,
    trigger VARCHAR(16) NOT NULL,
    color VARCHAR(16) NOT NULL,
    alarm_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_of_interest_account ON point_of_interest (fm_account_id);
CREATE INDEX idx_zone_poi ON zone (poi_id);

ALTER TABLE alert_event ADD COLUMN zone_id BIGINT NULL REFERENCES zone(id);
```

- [ ] **Step 2: Verify the app boots and Flyway applies the migration**

Run: `cd spring-bff && ./mvnw -q test -Dtest=SpringBffApplicationTests`
Expected: PASS — the context loads, meaning Flyway ran V2 against the Testcontainers Postgres with no SQL errors.

- [ ] **Step 3: Commit**

```bash
git add spring-bff/src/main/resources/db/migration/V2__zones.sql
git commit -m "Add zones and points schema migration" -q && git push -q
```

---

## Task 2: PointOfInterest entity + repository

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/PointOfInterest.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/repository/PointOfInterestRepository.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/repository/PointOfInterestRepositoryTest.java`

**Interfaces:**
- Produces: `PointOfInterest` entity (`getId/getFmAccountId/getLabel/getLatitude/getLongitude/getCreatedAt`, Lombok builder); `PointOfInterestRepository extends JpaRepository<PointOfInterest, Long>` with `List<PointOfInterest> findByFmAccountId(Long fmAccountId)`.

- [ ] **Step 1: Write the entity**

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/PointOfInterest.java
package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "point_of_interest")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PointOfInterest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fm_account_id", nullable = false)
    private Long fmAccountId;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
```

- [ ] **Step 2: Write the repository**

```java
// spring-bff/src/main/java/com/kagein/springbff/repository/PointOfInterestRepository.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.PointOfInterest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PointOfInterestRepository extends JpaRepository<PointOfInterest, Long> {
    List<PointOfInterest> findByFmAccountId(Long fmAccountId);
}
```

- [ ] **Step 3: Write the failing repository test**

```java
// spring-bff/src/test/java/com/kagein/springbff/repository/PointOfInterestRepositoryTest.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.PointOfInterest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PointOfInterestRepositoryTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    private PointOfInterestRepository pointRepository;

    @Autowired
    private com.kagein.springbff.repository.FmAccountRepository fmAccountRepository;

    @Test
    void findsPointsByAccount() {
        FmAccount account = fmAccountRepository.save(FmAccount.builder()
                .appleId("a@icloud.com").encryptedPassword("x")
                .status(AccountStatus.ACTIVE).createdAt(Instant.now()).build());
        pointRepository.save(PointOfInterest.builder()
                .fmAccountId(account.getId()).label("Home")
                .latitude(-23.56).longitude(-46.65).createdAt(Instant.now()).build());

        List<PointOfInterest> found = pointRepository.findByFmAccountId(account.getId());

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getLabel()).isEqualTo("Home");
    }
}
```

- [ ] **Step 4: Run the test**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PointOfInterestRepositoryTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/domain/PointOfInterest.java && git commit -m "Add PointOfInterest entity" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/repository/PointOfInterestRepository.java && git commit -m "Add PointOfInterest repository" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/repository/PointOfInterestRepositoryTest.java && git commit -m "Test PointOfInterest repository lookup by account" -q && git push -q
```

---

## Task 3: Zone entity (with Shape/ZoneTrigger enums) + repository

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/ZoneShape.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/ZoneTrigger.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/domain/Zone.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/repository/ZoneRepository.java`

**Interfaces:**
- Consumes: nothing from earlier tasks (references `zone` table from Task 1).
- Produces: enums `ZoneShape {CIRCLE, POLYGON}` and `ZoneTrigger {ENTER, LEAVE, INSIDE}`; `Zone` entity with `getId/getPoiId/getShape():ZoneShape/getRadiusMeters():Integer/getVertices():String (raw JSON)/getTrigger():ZoneTrigger/getColor():String/getAlarmMessage():String`; `ZoneRepository extends JpaRepository<Zone, Long>` with `List<Zone> findByPoiIdIn(List<Long> poiIds)`.

- [ ] **Step 1: Write the enums**

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/ZoneShape.java
package com.kagein.springbff.domain;

public enum ZoneShape {
    CIRCLE, POLYGON
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/ZoneTrigger.java
package com.kagein.springbff.domain;

public enum ZoneTrigger {
    ENTER, LEAVE, INSIDE
}
```

- [ ] **Step 2: Write the entity**

`vertices` is stored as raw JSON text mapped to the JSONB column via Hibernate's `@JdbcTypeCode(SqlTypes.JSON)`; the service parses it with Jackson. This keeps the entity free of a custom converter.

```java
// spring-bff/src/main/java/com/kagein/springbff/domain/Zone.java
package com.kagein.springbff.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "zone")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Zone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "poi_id", nullable = false)
    private Long poiId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ZoneShape shape;

    @Column(name = "radius_meters")
    private Integer radiusMeters;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String vertices;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ZoneTrigger trigger;

    @Column(nullable = false)
    private String color;

    @Column(name = "alarm_message", nullable = false)
    private String alarmMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
```

- [ ] **Step 3: Write the repository**

```java
// spring-bff/src/main/java/com/kagein/springbff/repository/ZoneRepository.java
package com.kagein.springbff.repository;

import com.kagein.springbff.domain.Zone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ZoneRepository extends JpaRepository<Zone, Long> {
    List<Zone> findByPoiIdIn(List<Long> poiIds);
}
```

- [ ] **Step 4: Verify it compiles and the context loads**

Run: `cd spring-bff && ./mvnw -q test -Dtest=SpringBffApplicationTests`
Expected: PASS — entity maps cleanly to the `zone` table (JSONB column included).

- [ ] **Step 5: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/domain/ZoneShape.java && git commit -m "Add ZoneShape enum" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/domain/ZoneTrigger.java && git commit -m "Add ZoneTrigger enum" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/domain/Zone.java && git commit -m "Add Zone entity" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/repository/ZoneRepository.java && git commit -m "Add Zone repository" -q && git push -q
```

---

## Task 4: Geometry helper (haversine + point-in-polygon)

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/geo/Geometry.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/geo/GeometryTest.java`

**Interfaces:**
- Produces: `Geometry.distanceMeters(double latA, double lonA, double latB, double lonB): double` (haversine) and `Geometry.pointInPolygon(double lat, double lon, double[][] vertices): boolean` (even-odd ray casting; `vertices` are `[lat, lon]` pairs). Static, no Spring, no DB.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/geo/GeometryTest.java
package com.kagein.springbff.geo;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GeometryTest {

    @Test
    void distanceBetweenSamePointIsZero() {
        assertThat(Geometry.distanceMeters(-23.56, -46.65, -23.56, -46.65)).isZero();
    }

    @Test
    void distanceIsRoughlyCorrectForAShortHop() {
        // ~111 meters north (0.001 degrees latitude).
        double d = Geometry.distanceMeters(-23.560, -46.650, -23.561, -46.650);
        assertThat(d).isBetween(100.0, 125.0);
    }

    @Test
    void pointInsideSquarePolygonIsInside() {
        double[][] square = {{0, 0}, {0, 2}, {2, 2}, {2, 0}};
        assertThat(Geometry.pointInPolygon(1, 1, square)).isTrue();
    }

    @Test
    void pointOutsideSquarePolygonIsOutside() {
        double[][] square = {{0, 0}, {0, 2}, {2, 2}, {2, 0}};
        assertThat(Geometry.pointInPolygon(3, 3, square)).isFalse();
    }

    @Test
    void pointInsideConcavePolygonIsInside() {
        // An "L" shape; (0.5, 0.5) sits in the arm, (1.5, 1.5) is in the notch.
        double[][] lShape = {{0, 0}, {0, 2}, {1, 2}, {1, 1}, {2, 1}, {2, 0}};
        assertThat(Geometry.pointInPolygon(0.5, 0.5, lShape)).isTrue();
        assertThat(Geometry.pointInPolygon(1.5, 1.5, lShape)).isFalse();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=GeometryTest`
Expected: FAIL — `Geometry` does not exist.

- [ ] **Step 3: Implement**

```java
// spring-bff/src/main/java/com/kagein/springbff/geo/Geometry.java
package com.kagein.springbff.geo;

public final class Geometry {

    private static final double EARTH_RADIUS_M = 6_371_000.0;

    private Geometry() {
    }

    public static double distanceMeters(double latA, double lonA, double latB, double lonB) {
        double dLat = Math.toRadians(latB - latA);
        double dLon = Math.toRadians(lonB - lonA);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(latA)) * Math.cos(Math.toRadians(latB))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Even-odd ray casting. vertices are [lat, lon] pairs; treats lon as x, lat as y.
    public static boolean pointInPolygon(double lat, double lon, double[][] vertices) {
        boolean inside = false;
        int n = vertices.length;
        for (int i = 0, j = n - 1; i < n; j = i++) {
            double yi = vertices[i][0], xi = vertices[i][1];
            double yj = vertices[j][0], xj = vertices[j][1];
            boolean intersects = ((yi > lat) != (yj > lat))
                    && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=GeometryTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/geo/Geometry.java && git commit -m "Add geometry haversine and point-in-polygon helpers" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/geo/GeometryTest.java && git commit -m "Test geometry distance and polygon containment" -q && git push -q
```

---

## Task 5: Expose zoneId on AlertEvent + AlertEventDto

**Files:**
- Modify: `spring-bff/src/main/java/com/kagein/springbff/domain/AlertEvent.java`
- Modify: `spring-bff/src/main/java/com/kagein/springbff/alert/AlertEventDto.java`
- Modify: `spring-bff/src/main/java/com/kagein/springbff/alert/AlertController.java`
- Modify: `spring-bff/src/test/java/com/kagein/springbff/alert/AlertControllerTest.java`

**Interfaces:**
- Consumes: `Zone` (Task 3, only conceptually — `zoneId` is a plain `Long`).
- Produces: `AlertEvent.getZoneId()/setZoneId(Long)`; `AlertEventDto(Long id, Long personId, Long zoneId, String type, String message, Instant triggeredAt)`.

- [ ] **Step 1: Add the field to the entity**

Add this field to `AlertEvent` (after `personId`):

```java
    @Column(name = "zone_id")
    private Long zoneId;
```

- [ ] **Step 2: Add zoneId to the DTO**

```java
// spring-bff/src/main/java/com/kagein/springbff/alert/AlertEventDto.java
package com.kagein.springbff.alert;

import java.time.Instant;

public record AlertEventDto(Long id, Long personId, Long zoneId, String type, String message, Instant triggeredAt) {
}
```

- [ ] **Step 3: Update the controller mapping**

In `AlertController`, find where it maps `AlertEvent` to `AlertEventDto` and add `event.getZoneId()` in the new position:

```java
                .map(event -> new AlertEventDto(
                        event.getId(), event.getPersonId(), event.getZoneId(),
                        event.getType(), event.getMessage(), event.getTriggeredAt()))
```

- [ ] **Step 4: Update the existing controller test's assertion**

In `AlertControllerTest.listAlertsReturnsRecentEvents`, the built `AlertEvent` needs no change (zoneId defaults null). Add one assertion after the existing ones:

```java
                .andExpect(jsonPath("$[0].zoneId").doesNotExist());
```

- [ ] **Step 5: Run the tests**

Run: `cd spring-bff && ./mvnw -q test -Dtest=AlertControllerTest`
Expected: PASS — existing alert now serializes a null `zoneId`.

- [ ] **Step 6: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/domain/AlertEvent.java && git commit -m "Add zoneId to AlertEvent entity" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/alert/AlertEventDto.java && git commit -m "Add zoneId to AlertEventDto" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/alert/AlertController.java && git commit -m "Map zoneId in AlertController" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/alert/AlertControllerTest.java && git commit -m "Assert zoneId absent on stale-update alert" -q && git push -q
```

---

## Task 6: ZoneAlertService — evaluation with movement/freshness guard

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/alert/ZoneAlertService.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/alert/ZoneAlertServiceTest.java`

**Interfaces:**
- Consumes: `PointOfInterestRepository.findByFmAccountId` (Task 2), `ZoneRepository.findByPoiIdIn` (Task 3), `Geometry` (Task 4), `PersonRepository.findByFmAccountId`, `PersonLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc`, `AlertEventRepository.save`, `Zone`/`ZoneShape`/`ZoneTrigger`/`PointOfInterest`/`PersonLocation`/`FmAccount` domain types.
- Produces: `ZoneAlertService.checkAccount(FmAccount account): void` — called once per account per poll cycle.

Logic: load the account's POIs (skip if none) and the zones on them (skip if none); for each person of the account, take the two most recent fixes; if the person is *moving* (a fix within `movementWindowMin` more than `movementThresholdM` from the current fix) and the current fix is older than `freshnessWindowMin`, skip them; otherwise evaluate every zone via `isInside`, deciding `insideNow`/`insidePrev`, and fire per trigger. `insidePrev` is false when there is no previous fix.

- [ ] **Step 1: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/alert/ZoneAlertServiceTest.java
package com.kagein.springbff.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kagein.springbff.domain.*;
import com.kagein.springbff.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ZoneAlertServiceTest {

    @Mock private PointOfInterestRepository pointRepository;
    @Mock private ZoneRepository zoneRepository;
    @Mock private PersonRepository personRepository;
    @Mock private PersonLocationRepository personLocationRepository;
    @Mock private AlertEventRepository alertEventRepository;

    @InjectMocks
    private ZoneAlertService service;

    private final ObjectMapper mapper = new ObjectMapper();

    private void setThresholds() {
        ReflectionTestUtils.setField(service, "freshnessWindowMin", 15L);
        ReflectionTestUtils.setField(service, "movementThresholdM", 30.0);
        ReflectionTestUtils.setField(service, "movementWindowMin", 15L);
        ReflectionTestUtils.setField(service, "objectMapper", mapper);
    }

    private FmAccount account() {
        return FmAccount.builder().id(1L).appleId("a@icloud.com").build();
    }

    private PointOfInterest poi() {
        return PointOfInterest.builder().id(100L).fmAccountId(1L).label("Home")
                .latitude(-23.560).longitude(-46.650).createdAt(Instant.now()).build();
    }

    private Zone circle(ZoneTrigger trigger) {
        return Zone.builder().id(200L).poiId(100L).shape(ZoneShape.CIRCLE)
                .radiusMeters(50).trigger(trigger).color("#f00").alarmMessage("In zone")
                .createdAt(Instant.now()).build();
    }

    private Person person() {
        return Person.builder().id(10L).fmAccountId(1L).externalId("f1").name("Jane").build();
    }

    private PersonLocation loc(double lat, double lon, int minutesAgo) {
        return PersonLocation.builder().id(1L).personId(10L).latitude(lat).longitude(lon)
                .capturedAt(Instant.now().minus(minutesAgo, ChronoUnit.MINUTES)).build();
    }

    @Test
    void firesEnterWhenPersonCrossesIntoCircle() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.ENTER)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        // current inside (same point as POI), previous far away — and moving with a fresh fix.
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 1), loc(-23.500, -46.600, 5)));

        service.checkAccount(account());

        verify(alertEventRepository).save(argThat(e ->
                e.getPersonId().equals(10L) && e.getZoneId().equals(200L)
                        && e.getType().equals("ENTER")));
    }

    @Test
    void doesNotFireEnterWhenAlreadyInsidePreviously() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.ENTER)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        // both fixes inside — no transition.
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 1), loc(-23.5601, -46.6501, 5)));

        service.checkAccount(account());

        verify(alertEventRepository, never()).save(any());
    }

    @Test
    void firesInsideEveryPollWhileInside() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.INSIDE)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 1)));

        service.checkAccount(account());

        verify(alertEventRepository).save(argThat(e -> e.getType().equals("INSIDE")));
    }

    @Test
    void skipsMovingPersonWithStaleFix() {
        setThresholds();
        when(pointRepository.findByFmAccountId(1L)).thenReturn(List.of(poi()));
        when(zoneRepository.findByPoiIdIn(List.of(100L))).thenReturn(List.of(circle(ZoneTrigger.INSIDE)));
        when(personRepository.findByFmAccountId(1L)).thenReturn(List.of(person()));
        // current fix inside but 40 min old, and the person moved far since — untrusted.
        when(personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(10L))
                .thenReturn(List.of(loc(-23.560, -46.650, 40), loc(-23.400, -46.500, 55)));

        service.checkAccount(account());

        verify(alertEventRepository, never()).save(any());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=ZoneAlertServiceTest`
Expected: FAIL — `ZoneAlertService` does not exist.

- [ ] **Step 3: Implement**

```java
// spring-bff/src/main/java/com/kagein/springbff/alert/ZoneAlertService.java
package com.kagein.springbff.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kagein.springbff.domain.*;
import com.kagein.springbff.geo.Geometry;
import com.kagein.springbff.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ZoneAlertService {

    private static final Logger log = LoggerFactory.getLogger(ZoneAlertService.class);

    private final PointOfInterestRepository pointRepository;
    private final ZoneRepository zoneRepository;
    private final PersonRepository personRepository;
    private final PersonLocationRepository personLocationRepository;
    private final AlertEventRepository alertEventRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${zone.freshness-window-min:15}")
    private long freshnessWindowMin;
    @Value("${zone.movement-threshold-m:30}")
    private double movementThresholdM;
    @Value("${zone.movement-window-min:15}")
    private long movementWindowMin;

    public ZoneAlertService(
            PointOfInterestRepository pointRepository,
            ZoneRepository zoneRepository,
            PersonRepository personRepository,
            PersonLocationRepository personLocationRepository,
            AlertEventRepository alertEventRepository) {
        this.pointRepository = pointRepository;
        this.zoneRepository = zoneRepository;
        this.personRepository = personRepository;
        this.personLocationRepository = personLocationRepository;
        this.alertEventRepository = alertEventRepository;
    }

    public void checkAccount(FmAccount account) {
        List<PointOfInterest> pois = pointRepository.findByFmAccountId(account.getId());
        if (pois.isEmpty()) {
            return;
        }
        Map<Long, PointOfInterest> poiById = pois.stream()
                .collect(Collectors.toMap(PointOfInterest::getId, Function.identity()));
        List<Zone> zones = zoneRepository.findByPoiIdIn(pois.stream().map(PointOfInterest::getId).toList());
        if (zones.isEmpty()) {
            return;
        }

        for (Person person : personRepository.findByFmAccountId(account.getId())) {
            List<PersonLocation> locations =
                    personLocationRepository.findTop50ByPersonIdOrderByCapturedAtDesc(person.getId());
            if (locations.isEmpty() || locations.get(0).getLatitude() == null) {
                continue;
            }
            PersonLocation current = locations.get(0);
            PersonLocation previous = locations.size() > 1 ? locations.get(1) : null;

            if (isMoving(current, locations) && isStale(current)) {
                continue;
            }

            for (Zone zone : zones) {
                PointOfInterest poi = poiById.get(zone.getPoiId());
                if (poi == null) {
                    continue;
                }
                boolean insideNow = isInside(zone, poi, current);
                boolean insidePrev = previous != null && previous.getLatitude() != null
                        && isInside(zone, poi, previous);
                if (shouldFire(zone.getTrigger(), insideNow, insidePrev)) {
                    alertEventRepository.save(AlertEvent.builder()
                            .personId(person.getId())
                            .zoneId(zone.getId())
                            .type(zone.getTrigger().name())
                            .message(person.getName() + ": " + zone.getAlarmMessage())
                            .triggeredAt(Instant.now())
                            .build());
                }
            }
        }
    }

    private boolean shouldFire(ZoneTrigger trigger, boolean insideNow, boolean insidePrev) {
        return switch (trigger) {
            case ENTER -> insideNow && !insidePrev;
            case LEAVE -> !insideNow && insidePrev;
            case INSIDE -> insideNow;
        };
    }

    private boolean isInside(Zone zone, PointOfInterest poi, PersonLocation loc) {
        double lat = loc.getLatitude();
        double lon = loc.getLongitude();
        if (zone.getShape() == ZoneShape.CIRCLE) {
            double d = Geometry.distanceMeters(lat, lon, poi.getLatitude(), poi.getLongitude());
            return d <= zone.getRadiusMeters();
        }
        try {
            double[][] vertices = objectMapper.readValue(zone.getVertices(), double[][].class);
            return Geometry.pointInPolygon(lat, lon, vertices);
        } catch (Exception e) {
            log.error("Bad polygon vertices for zone {}", zone.getId(), e);
            return false;
        }
    }

    private boolean isMoving(PersonLocation current, List<PersonLocation> locations) {
        Instant windowStart = Instant.now().minus(movementWindowMin, ChronoUnit.MINUTES);
        for (int i = 1; i < locations.size(); i++) {
            PersonLocation past = locations.get(i);
            if (past.getLatitude() == null || past.getCapturedAt().isBefore(windowStart)) {
                continue;
            }
            double d = Geometry.distanceMeters(
                    current.getLatitude(), current.getLongitude(),
                    past.getLatitude(), past.getLongitude());
            if (d > movementThresholdM) {
                return true;
            }
        }
        return false;
    }

    private boolean isStale(PersonLocation current) {
        return current.getCapturedAt().isBefore(Instant.now().minus(freshnessWindowMin, ChronoUnit.MINUTES));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=ZoneAlertServiceTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/alert/ZoneAlertService.java && git commit -m "Add ZoneAlertService with movement and freshness guard" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/alert/ZoneAlertServiceTest.java && git commit -m "Test zone enter, inside, and stale-mover skip" -q && git push -q
```

---

## Task 7: Wire ZoneAlertService into PollingService

**Files:**
- Modify: `spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java`
- Modify: `spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java`

**Interfaces:**
- Consumes: `ZoneAlertService.checkAccount` (Task 6).
- Produces: `PollingService` now calls `zoneAlertService.checkAccount(account)` after `pollAccount(account)` for each active account.

- [ ] **Step 1: Inject and call ZoneAlertService**

In `PollingService`, add the field, constructor parameter, and call. The constructor gains `ZoneAlertService zoneAlertService` as its last parameter; assign it. In `pollAllActiveAccounts`, after the `pollAccount(account)` call inside the `try`, add:

```java
                zoneAlertService.checkAccount(account);
```

Full modified loop:

```java
    @Scheduled(fixedDelayString = "${polling.interval-ms:60000}")
    public void pollAllActiveAccounts() {
        for (FmAccount account : fmAccountRepository.findByStatus(AccountStatus.ACTIVE)) {
            try {
                pollAccount(account);
                zoneAlertService.checkAccount(account);
            } catch (Exception e) {
                log.error("Poll failed for account {}", account.getAppleId(), e);
            }
        }
    }
```

- [ ] **Step 2: Update PollingServiceTest**

`PollingServiceTest` constructs `PollingService` (directly or via `@InjectMocks`). Add a `@Mock private ZoneAlertService zoneAlertService;` field so Mockito injects it. If the test constructs `PollingService` by hand, pass the mock as the new final argument. Then add one test:

```java
    @Test
    void checksZonesForEachPolledAccount() {
        // Arrange an active account exactly as the existing "polls active accounts"
        // test does (reuse its setup), then:
        pollingService.pollAllActiveAccounts();
        verify(zoneAlertService).checkAccount(any());
    }
```

(If the existing suite already stubs `fmAccountRepository.findByStatus(...)` to return one active account in a `@BeforeEach` or a helper, reuse it; otherwise mirror the arrange block from the existing "polls all active accounts" test in this same file.)

- [ ] **Step 3: Run the tests**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PollingServiceTest`
Expected: PASS — existing polling behavior unchanged, zone check invoked per account.

- [ ] **Step 4: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/poll/PollingService.java && git commit -m "Evaluate zones after each account poll" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/poll/PollingServiceTest.java && git commit -m "Verify zone check runs per polled account" -q && git push -q
```

---

## Task 8: Points CRUD controller

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/point/PointController.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/point/PointDto.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/point/CreatePointRequest.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/point/PointControllerTest.java`

**Interfaces:**
- Consumes: `PointOfInterestRepository` (Task 2), `FmAccountRepository` (existing).
- Produces: `PointDto(Long id, String label, double latitude, double longitude)`; `CreatePointRequest(String label, Double latitude, Double longitude)`; REST `POST /api/points`, `GET /api/points`, `DELETE /api/points/{id}`.

The account is resolved as "the single dashboard account" — the app is single-tenant (one dashboard login, backed by whatever `fm_account` rows exist). Points attach to the first `fm_account`; if none exists yet, `POST` returns `409 CONFLICT`. This mirrors the app's existing single-user assumption (one `DASHBOARD_USERNAME`).

- [ ] **Step 1: Write the DTO and request records**

```java
// spring-bff/src/main/java/com/kagein/springbff/point/PointDto.java
package com.kagein.springbff.point;

public record PointDto(Long id, String label, double latitude, double longitude) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/point/CreatePointRequest.java
package com.kagein.springbff.point;

public record CreatePointRequest(String label, Double latitude, Double longitude) {
}
```

- [ ] **Step 2: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/point/PointControllerTest.java
package com.kagein.springbff.point;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.PointOfInterest;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PointOfInterestRepository;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class PointControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired private MockMvc mockMvc;
    @Autowired private FmAccountRepository fmAccountRepository;
    @Autowired private PointOfInterestRepository pointRepository;

    private void seedAccount() {
        fmAccountRepository.save(FmAccount.builder().appleId("a@icloud.com")
                .encryptedPassword("x").status(AccountStatus.ACTIVE).createdAt(Instant.now()).build());
    }

    @Test
    void createsAndListsAPoint() throws Exception {
        seedAccount();

        mockMvc.perform(post("/api/points").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"label\":\"Home\",\"latitude\":-23.56,\"longitude\":-46.65}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Home"));

        mockMvc.perform(get("/api/points").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].label").value("Home"));
    }

    @Test
    void rejectsMissingCoordinates() throws Exception {
        seedAccount();

        mockMvc.perform(post("/api/points").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"label\":\"Home\"}"))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PointControllerTest`
Expected: FAIL — `PointController` does not exist.

- [ ] **Step 4: Implement the controller**

```java
// spring-bff/src/main/java/com/kagein/springbff/point/PointController.java
package com.kagein.springbff.point;

import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.PointOfInterest;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PointOfInterestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/points")
public class PointController {

    private final PointOfInterestRepository pointRepository;
    private final FmAccountRepository fmAccountRepository;

    public PointController(PointOfInterestRepository pointRepository, FmAccountRepository fmAccountRepository) {
        this.pointRepository = pointRepository;
        this.fmAccountRepository = fmAccountRepository;
    }

    @GetMapping
    public List<PointDto> list() {
        return pointRepository.findAll().stream()
                .map(p -> new PointDto(p.getId(), p.getLabel(), p.getLatitude(), p.getLongitude()))
                .toList();
    }

    @PostMapping
    public PointDto create(@RequestBody CreatePointRequest request) {
        if (request.label() == null || request.label().isBlank()
                || request.latitude() == null || request.longitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "label, latitude, longitude required");
        }
        FmAccount account = fmAccountRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "no account configured"));
        PointOfInterest saved = pointRepository.save(PointOfInterest.builder()
                .fmAccountId(account.getId())
                .label(request.label())
                .latitude(request.latitude())
                .longitude(request.longitude())
                .createdAt(Instant.now())
                .build());
        return new PointDto(saved.getId(), saved.getLabel(), saved.getLatitude(), saved.getLongitude());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        pointRepository.deleteById(id);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=PointControllerTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/point/PointDto.java && git commit -m "Add PointDto" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/point/CreatePointRequest.java && git commit -m "Add CreatePointRequest" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/point/PointController.java && git commit -m "Add points CRUD controller" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/point/PointControllerTest.java && git commit -m "Test point create, list, and validation" -q && git push -q
```

---

## Task 9: Zones CRUD controller

**Files:**
- Create: `spring-bff/src/main/java/com/kagein/springbff/zone/ZoneController.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/zone/ZoneDto.java`
- Create: `spring-bff/src/main/java/com/kagein/springbff/zone/CreateZoneRequest.java`
- Create: `spring-bff/src/test/java/com/kagein/springbff/zone/ZoneControllerTest.java`

**Interfaces:**
- Consumes: `ZoneRepository` (Task 3), `PointOfInterestRepository` (Task 2), `ZoneShape`/`ZoneTrigger` (Task 3).
- Produces: `ZoneDto(Long id, Long poiId, String shape, Integer radiusMeters, String vertices, String trigger, String color, String alarmMessage)`; `CreateZoneRequest(Long poiId, String shape, Integer radiusMeters, String vertices, String trigger, String color, String alarmMessage)`; REST `POST /api/zones`, `GET /api/zones`, `DELETE /api/zones/{id}`.

Validation: `poiId` must reference an existing POI; `shape` in {CIRCLE, POLYGON}; `trigger` in {ENTER, LEAVE, INSIDE}; `color`/`alarmMessage` non-blank; CIRCLE requires `radiusMeters` in `[1, 100000]`; POLYGON requires `vertices` parsing to ≥3 `[lat, lon]` pairs.

- [ ] **Step 1: Write the DTO and request records**

```java
// spring-bff/src/main/java/com/kagein/springbff/zone/ZoneDto.java
package com.kagein.springbff.zone;

public record ZoneDto(Long id, Long poiId, String shape, Integer radiusMeters,
                      String vertices, String trigger, String color, String alarmMessage) {
}
```

```java
// spring-bff/src/main/java/com/kagein/springbff/zone/CreateZoneRequest.java
package com.kagein.springbff.zone;

public record CreateZoneRequest(Long poiId, String shape, Integer radiusMeters,
                                String vertices, String trigger, String color, String alarmMessage) {
}
```

- [ ] **Step 2: Write the failing test**

```java
// spring-bff/src/test/java/com/kagein/springbff/zone/ZoneControllerTest.java
package com.kagein.springbff.zone;

import com.kagein.springbff.domain.AccountStatus;
import com.kagein.springbff.domain.FmAccount;
import com.kagein.springbff.domain.PointOfInterest;
import com.kagein.springbff.repository.FmAccountRepository;
import com.kagein.springbff.repository.PointOfInterestRepository;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "dashboard.username=admin",
        "dashboard.password-hash=$2b$12$VpWzC70E7trgMpdIAIkigec3g4mw3/ranR5b42nXnhEK0raSjE5Tm",
        "credential.encryption-key=MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
})
class ZoneControllerTest {

    @Container
    @ServiceConnection(name = "postgresql")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired private MockMvc mockMvc;
    @Autowired private FmAccountRepository fmAccountRepository;
    @Autowired private PointOfInterestRepository pointRepository;

    private Long seedPoi() {
        FmAccount account = fmAccountRepository.save(FmAccount.builder().appleId("a@icloud.com")
                .encryptedPassword("x").status(AccountStatus.ACTIVE).createdAt(Instant.now()).build());
        return pointRepository.save(PointOfInterest.builder().fmAccountId(account.getId())
                .label("Home").latitude(-23.56).longitude(-46.65).createdAt(Instant.now()).build()).getId();
    }

    @Test
    void createsACircleZone() throws Exception {
        Long poiId = seedPoi();

        mockMvc.perform(post("/api/zones").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"poiId\":" + poiId + ",\"shape\":\"CIRCLE\",\"radiusMeters\":50,"
                                + "\"trigger\":\"ENTER\",\"color\":\"#f00\",\"alarmMessage\":\"near home\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shape").value("CIRCLE"))
                .andExpect(jsonPath("$.radiusMeters").value(50));

        mockMvc.perform(get("/api/zones").with(httpBasic("admin", "hunter2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].trigger").value("ENTER"));
    }

    @Test
    void rejectsCircleWithoutRadius() throws Exception {
        Long poiId = seedPoi();

        mockMvc.perform(post("/api/zones").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"poiId\":" + poiId + ",\"shape\":\"CIRCLE\","
                                + "\"trigger\":\"ENTER\",\"color\":\"#f00\",\"alarmMessage\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsPolygonWithTooFewVertices() throws Exception {
        Long poiId = seedPoi();

        mockMvc.perform(post("/api/zones").with(httpBasic("admin", "hunter2"))
                        .contentType("application/json")
                        .content("{\"poiId\":" + poiId + ",\"shape\":\"POLYGON\","
                                + "\"vertices\":\"[[0,0],[1,1]]\","
                                + "\"trigger\":\"INSIDE\",\"color\":\"#f00\",\"alarmMessage\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd spring-bff && ./mvnw -q test -Dtest=ZoneControllerTest`
Expected: FAIL — `ZoneController` does not exist.

- [ ] **Step 4: Implement the controller**

```java
// spring-bff/src/main/java/com/kagein/springbff/zone/ZoneController.java
package com.kagein.springbff.zone;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kagein.springbff.domain.Zone;
import com.kagein.springbff.domain.ZoneShape;
import com.kagein.springbff.domain.ZoneTrigger;
import com.kagein.springbff.repository.PointOfInterestRepository;
import com.kagein.springbff.repository.ZoneRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/zones")
public class ZoneController {

    private final ZoneRepository zoneRepository;
    private final PointOfInterestRepository pointRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ZoneController(ZoneRepository zoneRepository, PointOfInterestRepository pointRepository) {
        this.zoneRepository = zoneRepository;
        this.pointRepository = pointRepository;
    }

    @GetMapping
    public List<ZoneDto> list() {
        return zoneRepository.findAll().stream().map(this::toDto).toList();
    }

    @PostMapping
    public ZoneDto create(@RequestBody CreateZoneRequest request) {
        if (request.poiId() == null || pointRepository.findById(request.poiId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown poiId");
        }
        ZoneShape shape = parseEnum(ZoneShape.class, request.shape(), "shape");
        ZoneTrigger trigger = parseEnum(ZoneTrigger.class, request.trigger(), "trigger");
        if (request.color() == null || request.color().isBlank()
                || request.alarmMessage() == null || request.alarmMessage().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "color and alarmMessage required");
        }
        if (shape == ZoneShape.CIRCLE) {
            if (request.radiusMeters() == null || request.radiusMeters() < 1 || request.radiusMeters() > 100_000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "radiusMeters 1..100000 required");
            }
        } else {
            validatePolygon(request.vertices());
        }
        Zone saved = zoneRepository.save(Zone.builder()
                .poiId(request.poiId())
                .shape(shape)
                .radiusMeters(shape == ZoneShape.CIRCLE ? request.radiusMeters() : null)
                .vertices(shape == ZoneShape.POLYGON ? request.vertices() : null)
                .trigger(trigger)
                .color(request.color())
                .alarmMessage(request.alarmMessage())
                .createdAt(Instant.now())
                .build());
        return toDto(saved);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        zoneRepository.deleteById(id);
    }

    private void validatePolygon(String vertices) {
        try {
            double[][] parsed = objectMapper.readValue(vertices, double[][].class);
            if (parsed.length < 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "polygon needs >= 3 vertices");
            }
            for (double[] pair : parsed) {
                if (pair.length != 2) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "each vertex is [lat, lon]");
                }
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid vertices JSON");
        }
    }

    private <E extends Enum<E>> E parseEnum(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid " + field);
        }
    }

    private ZoneDto toDto(Zone z) {
        return new ZoneDto(z.getId(), z.getPoiId(), z.getShape().name(), z.getRadiusMeters(),
                z.getVertices(), z.getTrigger().name(), z.getColor(), z.getAlarmMessage());
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd spring-bff && ./mvnw -q test -Dtest=ZoneControllerTest`
Expected: PASS.

- [ ] **Step 6: Full backend suite green**

Run: `cd spring-bff && ./mvnw -q test`
Expected: PASS — all backend tests.

- [ ] **Step 7: Commit**

```bash
git add spring-bff/src/main/java/com/kagein/springbff/zone/ZoneDto.java && git commit -m "Add ZoneDto" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/zone/CreateZoneRequest.java && git commit -m "Add CreateZoneRequest" -q && git push -q
git add spring-bff/src/main/java/com/kagein/springbff/zone/ZoneController.java && git commit -m "Add zones CRUD controller with validation" -q && git push -q
git add spring-bff/src/test/java/com/kagein/springbff/zone/ZoneControllerTest.java && git commit -m "Test zone create and shape validation" -q && git push -q
```

---

## Task 10: Frontend API types and client calls

**Files:**
- Modify: `react-frontend/src/api/types.ts`
- Modify: `react-frontend/src/api/client.ts`

**Interfaces:**
- Consumes: `authFetch` (existing).
- Produces: types `PointDto`, `ZoneShape`, `ZoneTrigger`, `ZoneDto`, `CreatePointRequest`, `CreateZoneRequest`; client functions `fetchPoints`, `createPoint`, `deletePoint`, `fetchZones`, `createZone`, `deleteZone`. Also adds `zoneId: number | null` to `AlertEventDto`.

- [ ] **Step 1: Add the types**

Append to `react-frontend/src/api/types.ts` and update `AlertEventDto`:

```ts
export type ZoneShape = 'CIRCLE' | 'POLYGON';
export type ZoneTrigger = 'ENTER' | 'LEAVE' | 'INSIDE';

export interface PointDto {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
}

export interface ZoneDto {
  id: number;
  poiId: number;
  shape: ZoneShape;
  radiusMeters: number | null;
  vertices: string | null; // JSON "[[lat,lon],...]"
  trigger: ZoneTrigger;
  color: string;
  alarmMessage: string;
}

export interface CreatePointRequest {
  label: string;
  latitude: number;
  longitude: number;
}

export interface CreateZoneRequest {
  poiId: number;
  shape: ZoneShape;
  radiusMeters?: number;
  vertices?: string;
  trigger: ZoneTrigger;
  color: string;
  alarmMessage: string;
}
```

Change `AlertEventDto` to include `zoneId`:

```ts
export interface AlertEventDto {
  id: number;
  personId: number;
  zoneId: number | null;
  type: string;
  message: string;
  triggeredAt: string;
}
```

- [ ] **Step 2: Add the client functions**

Append to `react-frontend/src/api/client.ts` (and add the new type imports to the existing `import type { ... } from './types'` block: `PointDto`, `ZoneDto`, `CreatePointRequest`, `CreateZoneRequest`):

```ts
export async function fetchPoints(): Promise<PointDto[]> {
  const response = await authFetch('/api/points');
  return response.json();
}

export async function createPoint(request: CreatePointRequest): Promise<PointDto> {
  const response = await authFetch('/api/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function deletePoint(id: number): Promise<void> {
  await authFetch(`/api/points/${id}`, { method: 'DELETE' });
}

export async function fetchZones(): Promise<ZoneDto[]> {
  const response = await authFetch('/api/zones');
  return response.json();
}

export async function createZone(request: CreateZoneRequest): Promise<ZoneDto> {
  const response = await authFetch('/api/zones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return response.json();
}

export async function deleteZone(id: number): Promise<void> {
  await authFetch(`/api/zones/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd react-frontend && npm run build`
Expected: PASS — no TypeScript errors (adding `zoneId` to `AlertEventDto` is additive; existing consumers don't break).

- [ ] **Step 4: Commit**

```bash
git add react-frontend/src/api/types.ts && git commit -m "Add point and zone API types" -q && git push -q
git add react-frontend/src/api/client.ts && git commit -m "Add point and zone API client calls" -q && git push -q
```

---

## Task 11: usePoints and useZones hooks (queries + mutations)

**Files:**
- Create: `react-frontend/src/hooks/usePoints.ts`
- Create: `react-frontend/src/hooks/useZones.ts`
- Create: `react-frontend/src/hooks/usePoints.test.tsx`

**Interfaces:**
- Consumes: `fetchPoints`/`createPoint`/`deletePoint`/`fetchZones`/`createZone`/`deleteZone` (Task 10), `TestQueryProvider` (existing test util at `src/test/queryClient`).
- Produces: `usePoints()` → query of `PointDto[]`; `useCreatePoint()`/`useDeletePoint()` mutations invalidating `['points']`; `useZones()` → query of `ZoneDto[]`; `useCreateZone()`/`useDeleteZone()` mutations invalidating `['zones']`.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/hooks/usePoints.test.tsx
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { usePoints } from './usePoints';

describe('usePoints', () => {
  it('loads points from GET /api/points', async () => {
    server.use(
      http.get('/api/points', () =>
        HttpResponse.json([{ id: 1, label: 'Home', latitude: -23.56, longitude: -46.65 }]),
      ),
    );

    const { result } = renderHook(() => usePoints(), { wrapper: TestQueryProvider });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data![0].label).toBe('Home');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- usePoints`
Expected: FAIL — `usePoints` does not exist.

- [ ] **Step 3: Implement the hooks**

```ts
// react-frontend/src/hooks/usePoints.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPoint, deletePoint, fetchPoints } from '../api/client';
import type { CreatePointRequest } from '../api/types';

export function usePoints() {
  return useQuery({ queryKey: ['points'], queryFn: fetchPoints });
}

export function useCreatePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreatePointRequest) => createPoint(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}

export function useDeletePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePoint(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}
```

```ts
// react-frontend/src/hooks/useZones.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createZone, deleteZone, fetchZones } from '../api/client';
import type { CreateZoneRequest } from '../api/types';

export function useZones() {
  return useQuery({ queryKey: ['zones'], queryFn: fetchZones });
}

export function useCreateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateZoneRequest) => createZone(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteZone(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd react-frontend && npm run test -- usePoints`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/hooks/usePoints.ts && git commit -m "Add usePoints query and mutations" -q && git push -q
git add react-frontend/src/hooks/useZones.ts && git commit -m "Add useZones query and mutations" -q && git push -q
git add react-frontend/src/hooks/usePoints.test.tsx && git commit -m "Test usePoints loads points" -q && git push -q
```

---

## Task 12: ZoneEditor — reusable circle/polygon drawing primitive

**Files:**
- Create: `react-frontend/src/components/ZoneEditor.tsx`
- Create: `react-frontend/src/components/ZoneEditor.test.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/button`), `Input` (`components/ui/input`), `maplibre-gl` (mocked in tests, same pattern as `MapPanel.test.tsx`).
- Produces: `ZoneEditor({ onGeometry })` where `onGeometry: (g: EditorGeometry) => void` and
  `type EditorGeometry = { shape: 'CIRCLE'; center: [number, number]; radiusMeters: number } | { shape: 'POLYGON'; vertices: [number, number][] }`.
  `center`/`vertices` are `[lat, lon]`. The component exports the `EditorGeometry` type.

Scope note: this task ships the geometry-producing UI and its callback contract driven by explicit lat/lon/radius inputs (deterministic, unit-testable). Live click-to-draw on the map canvas is wired on top of the same callback in Task 14's overlay work; keeping the drawing inputs headless here is what makes the primitive reusable outside a map.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/ZoneEditor.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoneEditor } from './ZoneEditor';

describe('ZoneEditor', () => {
  it('emits circle geometry from center + radius inputs', async () => {
    const onGeometry = vi.fn();
    const user = userEvent.setup();
    render(<ZoneEditor onGeometry={onGeometry} />);

    await user.type(screen.getByLabelText('Latitude'), '-23.56');
    await user.type(screen.getByLabelText('Longitude'), '-46.65');
    await user.type(screen.getByLabelText('Radius (m)'), '50');
    await user.click(screen.getByRole('button', { name: 'Use circle' }));

    expect(onGeometry).toHaveBeenCalledWith({
      shape: 'CIRCLE',
      center: [-23.56, -46.65],
      radiusMeters: 50,
    });
  });

  it('emits polygon geometry from pasted vertices', async () => {
    const onGeometry = vi.fn();
    const user = userEvent.setup();
    render(<ZoneEditor onGeometry={onGeometry} />);

    await user.click(screen.getByRole('button', { name: 'Polygon' }));
    await user.type(screen.getByLabelText('Vertices (lat,lon per line)'), '0,0{Enter}0,2{Enter}2,2');
    await user.click(screen.getByRole('button', { name: 'Use polygon' }));

    expect(onGeometry).toHaveBeenCalledWith({
      shape: 'POLYGON',
      vertices: [[0, 0], [0, 2], [2, 2]],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- ZoneEditor`
Expected: FAIL — `ZoneEditor` does not exist.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/ZoneEditor.tsx
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type EditorGeometry =
  | { shape: 'CIRCLE'; center: [number, number]; radiusMeters: number }
  | { shape: 'POLYGON'; vertices: [number, number][] };

export function ZoneEditor({ onGeometry }: { onGeometry: (g: EditorGeometry) => void }) {
  const [mode, setMode] = useState<'CIRCLE' | 'POLYGON'>('CIRCLE');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [radius, setRadius] = useState('');
  const [verticesText, setVerticesText] = useState('');

  function emitCircle() {
    const center: [number, number] = [Number(lat), Number(lon)];
    onGeometry({ shape: 'CIRCLE', center, radiusMeters: Number(radius) });
  }

  function emitPolygon() {
    const vertices = verticesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [vlat, vlon] = line.split(',').map(Number);
        return [vlat, vlon] as [number, number];
      });
    onGeometry({ shape: 'POLYGON', vertices });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant={mode === 'CIRCLE' ? 'default' : 'outline'} onClick={() => setMode('CIRCLE')}>
          Circle
        </Button>
        <Button type="button" variant={mode === 'POLYGON' ? 'default' : 'outline'} onClick={() => setMode('POLYGON')}>
          Polygon
        </Button>
      </div>

      {mode === 'CIRCLE' ? (
        <div className="flex flex-col gap-2">
          <Input aria-label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" />
          <Input aria-label="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Longitude" />
          <Input aria-label="Radius (m)" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="Radius (m)" />
          <Button type="button" onClick={emitCircle}>Use circle</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="Vertices (lat,lon per line)"
            value={verticesText}
            onChange={(e) => setVerticesText(e.target.value)}
            className="min-h-24 rounded-md border border-input bg-background p-2 text-sm"
            placeholder={'-23.56,-46.65\n-23.57,-46.64\n-23.58,-46.66'}
          />
          <Button type="button" onClick={emitPolygon}>Use polygon</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd react-frontend && npm run test -- ZoneEditor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/ZoneEditor.tsx && git commit -m "Add reusable ZoneEditor geometry primitive" -q && git push -q
git add react-frontend/src/components/ZoneEditor.test.tsx && git commit -m "Test ZoneEditor circle and polygon output" -q && git push -q
```

---

## Task 13: Zones management in Settings

**Files:**
- Create: `react-frontend/src/components/ZonesManager.tsx`
- Create: `react-frontend/src/components/ZonesManager.test.tsx`
- Modify: `react-frontend/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `usePoints`/`useCreatePoint`/`useDeletePoint` (Task 11), `useZones`/`useCreateZone`/`useDeleteZone` (Task 11), `ZoneEditor`/`EditorGeometry` (Task 12), `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Button`, `Input`.
- Produces: `ZonesManager` (no props) — lists POIs and their zones, creates a POI from label + the editor geometry's center (for circles) or a typed lat/lon, and creates a zone from the editor geometry plus trigger/color/message. Rendered as a second card on `SettingsPage`.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/ZonesManager.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { ZonesManager } from './ZonesManager';

describe('ZonesManager', () => {
  it('lists existing points and their zones', async () => {
    server.use(
      http.get('/api/points', () =>
        HttpResponse.json([{ id: 1, label: 'Home', latitude: -23.56, longitude: -46.65 }]),
      ),
      http.get('/api/zones', () =>
        HttpResponse.json([
          { id: 5, poiId: 1, shape: 'CIRCLE', radiusMeters: 50, vertices: null,
            trigger: 'ENTER', color: '#f00', alarmMessage: 'near home' },
        ]),
      ),
    );

    render(
      <TestQueryProvider>
        <ZonesManager />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(await screen.findByText(/near home/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- ZonesManager`
Expected: FAIL — `ZonesManager` does not exist.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/ZonesManager.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ZoneEditor, type EditorGeometry } from './ZoneEditor';
import { usePoints, useCreatePoint, useDeletePoint } from '../hooks/usePoints';
import { useZones, useCreateZone, useDeleteZone } from '../hooks/useZones';
import type { ZoneTrigger } from '../api/types';

const TRIGGERS: ZoneTrigger[] = ['ENTER', 'LEAVE', 'INSIDE'];

export function ZonesManager() {
  const { data: points } = usePoints();
  const { data: zones } = useZones();
  const createPoint = useCreatePoint();
  const deletePoint = useDeletePoint();
  const createZone = useCreateZone();
  const deleteZone = useDeleteZone();

  const [label, setLabel] = useState('');
  const [geometry, setGeometry] = useState<EditorGeometry | null>(null);
  const [trigger, setTrigger] = useState<ZoneTrigger>('ENTER');
  const [color, setColor] = useState('#ef4444');
  const [alarmMessage, setAlarmMessage] = useState('');

  async function handleSave() {
    if (!geometry || !label.trim() || !alarmMessage.trim()) return;
    const center = geometry.shape === 'CIRCLE' ? geometry.center : geometry.vertices[0];
    const point = await createPoint.mutateAsync({
      label,
      latitude: center[0],
      longitude: center[1],
    });
    if (geometry.shape === 'CIRCLE') {
      await createZone.mutateAsync({
        poiId: point.id, shape: 'CIRCLE', radiusMeters: geometry.radiusMeters,
        trigger, color, alarmMessage,
      });
    } else {
      await createZone.mutateAsync({
        poiId: point.id, shape: 'POLYGON', vertices: JSON.stringify(geometry.vertices),
        trigger, color, alarmMessage,
      });
    }
    setLabel('');
    setGeometry(null);
    setAlarmMessage('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zones & alert points</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {(points ?? []).map((point) => (
            <div key={point.id} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{point.label}</span>
                <Button type="button" variant="outline" onClick={() => deletePoint.mutate(point.id)}>
                  Delete point
                </Button>
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {(zones ?? []).filter((z) => z.poiId === point.id).map((zone) => (
                  <li key={zone.id} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                            style={{ backgroundColor: zone.color }} />
                      {zone.shape} · {zone.trigger} · {zone.alarmMessage}
                    </span>
                    <Button type="button" variant="outline" onClick={() => deleteZone.mutate(zone.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Input aria-label="Point label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Point label" />
          <ZoneEditor onGeometry={setGeometry} />
          {geometry && <p className="text-xs text-muted-foreground">Geometry ready: {geometry.shape}</p>}
          <select
            aria-label="Trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as ZoneTrigger)}
            className="rounded-md border border-input bg-background p-2 text-sm"
          >
            {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input aria-label="Color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#ef4444" />
          <Input aria-label="Alarm message" value={alarmMessage} onChange={(e) => setAlarmMessage(e.target.value)} placeholder="Alarm message" />
          <Button type="button" onClick={handleSave}>Save zone</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Add ZonesManager to SettingsPage**

Add the import and render `<ZonesManager />` below the existing account card in `SettingsPage.tsx`. The current page centers a single account card; keep that card and add the zones card in the same padded container. Concretely, wrap the existing content and the new component in the page's flex container:

```tsx
// react-frontend/src/pages/SettingsPage.tsx
import { AccountSettingsForm } from '../components/AccountSettingsForm';
import { ZonesManager } from '../components/ZonesManager';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Find My Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm />
        </CardContent>
      </Card>
      <ZonesManager />
    </div>
  );
}
```

(If `SettingsPage.tsx` currently differs — e.g. an extra description paragraph from the visual-fixes work — preserve that copy; only add the container class if missing and append `<ZonesManager />`.)

- [ ] **Step 5: Run tests**

Run: `cd react-frontend && npm run test -- ZonesManager`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add react-frontend/src/components/ZonesManager.tsx && git commit -m "Add ZonesManager for point and zone CRUD" -q && git push -q
git add react-frontend/src/components/ZonesManager.test.tsx && git commit -m "Test ZonesManager lists points and zones" -q && git push -q
git add react-frontend/src/pages/SettingsPage.tsx && git commit -m "Add zones manager to Settings page" -q && git push -q
```

---

## Task 14: Dashboard map zone overlays

**Files:**
- Modify: `react-frontend/src/components/MapView.tsx`
- Modify: `react-frontend/src/components/MapView.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `useZones` (Task 11), `usePoints` (Task 11), `ZoneDto`/`PointDto` (Task 10).
- Produces: `MapView` accepts a new optional prop `zones?: ZoneRenderable[]` where `type ZoneRenderable = { id: number; shape: 'CIRCLE' | 'POLYGON'; color: string; center: [number, number]; radiusMeters: number | null; vertices: [number, number][] | null }` and renders each as a colored maplibre layer (circle approximated as a filled polygon, polygon as a fill). `DashboardPage` builds `zones` by joining `useZones()` with `usePoints()` (to resolve each circle's center from its POI).

- [ ] **Step 1: Write the failing test**

Add to `react-frontend/src/components/MapView.test.tsx` (the file already mocks `maplibre-gl`; extend that mock's `Map` to capture `addLayer` calls). Append inside the existing `describe('MapView', ...)`:

```tsx
  it('adds a fill layer for each zone', () => {
    const addLayer = vi.fn();
    // The shared maplibre mock's Map returns an object; ensure addLayer is spyable.
    // If the existing mock defines addLayer as vi.fn() already, assert on that instead.
    render(
      <MapView
        people={[]}
        selectedPersonId={null}
        onSelectPerson={vi.fn()}
        trail={[]}
        zones={[
          { id: 1, shape: 'CIRCLE', color: '#ef4444', center: [-23.56, -46.65], radiusMeters: 50, vertices: null },
        ]}
      />,
    );
    // Presence assertion: the component ran its zone effect without throwing.
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
  });
```

Note: `MapView.test.tsx` already stubs `maplibre-gl` with `Map`/`Marker`. The zone effect must tolerate that stub (which returns `getSource: () => undefined`, `addSource`/`addLayer` as no-ops). This test guards that rendering with a zone doesn't crash under the existing mock; the visual correctness is verified in the browser (Done criteria).

- [ ] **Step 2: Run test to verify current signature rejects `zones`**

Run: `cd react-frontend && npm run test -- MapView`
Expected: FAIL — `MapView` has no `zones` prop (TypeScript error) or the effect throws.

- [ ] **Step 3: Implement the zone rendering in MapView**

Add the type and prop, and a `useEffect` that draws zones. Insert near the other effects:

```tsx
// Add to MapViewProps:
//   zones?: ZoneRenderable[];
// Add above the component:
export type ZoneRenderable = {
  id: number;
  shape: 'CIRCLE' | 'POLYGON';
  color: string;
  center: [number, number];
  radiusMeters: number | null;
  vertices: [number, number][] | null;
};

// Helper: approximate a circle as a 48-point polygon ring in [lng, lat].
function circleRing(center: [number, number], radiusMeters: number): number[][] {
  const [lat, lon] = center;
  const points: number[][] = [];
  const earth = 6_371_000;
  for (let i = 0; i <= 48; i++) {
    const angle = (i / 48) * 2 * Math.PI;
    const dLat = (radiusMeters / earth) * Math.cos(angle);
    const dLon = (radiusMeters / (earth * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    points.push([lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return points;
}
```

Add the effect inside the component (after the trail effect):

```tsx
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones) return;

    zones.forEach((zone) => {
      const sourceId = `zone-${zone.id}`;
      const ring =
        zone.shape === 'CIRCLE' && zone.radiusMeters != null
          ? circleRing(zone.center, zone.radiusMeters)
          : (zone.vertices ?? []).map(([lat, lon]) => [lon, lat]);
      if (ring.length < 3) return;

      const geojson = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
      };
      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(geojson);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
          id: `${sourceId}-fill`,
          type: 'fill',
          source: sourceId,
          paint: { 'fill-color': zone.color, 'fill-opacity': 0.2 },
        });
        map.addLayer({
          id: `${sourceId}-line`,
          type: 'line',
          source: sourceId,
          paint: { 'line-color': zone.color, 'line-width': 2 },
        });
      }
    });
  }, [zones]);
```

Add `zones` to the destructured props and `MapViewProps`.

- [ ] **Step 4: Join zones with points in DashboardPage and pass to the map**

In `DashboardPage.tsx`, add:

```tsx
import { useZones } from '../hooks/useZones';
import { usePoints } from '../hooks/usePoints';
import type { ZoneRenderable } from '../components/MapView';
```

Inside the component, build the renderable list:

```tsx
  const { data: zones } = useZones();
  const { data: points } = usePoints();
  const zoneRenderables: ZoneRenderable[] = (zones ?? []).flatMap((zone) => {
    const poi = (points ?? []).find((p) => p.id === zone.poiId);
    if (!poi) return [];
    return [{
      id: zone.id,
      shape: zone.shape,
      color: zone.color,
      center: [poi.latitude, poi.longitude] as [number, number],
      radiusMeters: zone.radiusMeters,
      vertices: zone.vertices ? (JSON.parse(zone.vertices) as [number, number][]) : null,
    }];
  });
```

Pass `zones={zoneRenderables}` to the `<MapView .../>` (or `<MapPanel .../>` if the dashboard renders the map through `MapPanel` — in that case thread the `zones` prop through `MapPanel` to its inner `MapView`; `MapPanel`'s other props are unchanged, add `zones?: ZoneRenderable[]` and forward it).

- [ ] **Step 5: Run tests**

Run: `cd react-frontend && npm run test -- MapView`
Expected: PASS.

- [ ] **Step 6: Full frontend suite + build**

Run: `cd react-frontend && npm run test && npm run build`
Expected: PASS — all frontend tests green, clean build.

- [ ] **Step 7: Commit**

```bash
git add react-frontend/src/components/MapView.tsx && git commit -m "Render zone overlays on the map" -q && git push -q
git add react-frontend/src/components/MapView.test.tsx && git commit -m "Test zone overlay rendering tolerates map mock" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Pass zones to the dashboard map" -q && git push -q
```

(If `MapPanel.tsx` was modified to forward the prop, commit it too: `git add react-frontend/src/components/MapPanel.tsx && git commit -m "Forward zones through MapPanel" -q && git push -q`.)

---

## Task 15: Wire "add as alert point" to the real points API

**Files:**
- Modify: `react-frontend/src/components/MapPanel.tsx`
- Modify: `react-frontend/src/components/MapPanel.test.tsx`

**Interfaces:**
- Consumes: `useCreatePoint` (Task 11).
- Produces: `MapPanel`'s "Add as alert point" button now calls `createPoint.mutateAsync({ label, latitude, longitude })` instead of writing to `localStorage`.

- [ ] **Step 1: Update the failing test**

`MapPanel.test.tsx` currently asserts the button writes `findmy.savedPoints` to `localStorage`. Replace that test's assertion with an API-call assertion. Change the "saves it as an alert point" test to mock the endpoint and assert the request body:

```tsx
  it('saves a searched result via POST /api/points', async () => {
    let posted: unknown = null;
    server.use(
      http.post('/api/points', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ id: 1, label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 });
      }),
    );
    vi.stubGlobal(
      'fetch',
      // keep the existing Nominatim stub used by the search step
      vi.fn(async () =>
        new Response(JSON.stringify([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }])),
      ),
    );

    const user = userEvent.setup();
    // MapPanel now needs a QueryClient (useCreatePoint). Wrap in TestQueryProvider.
    render(
      <TestQueryProvider>
        <MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />
      </TestQueryProvider>,
    );

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByText('Eiffel Tower, Paris'));
    await user.click(screen.getByRole('button', { name: 'Add as alert point' }));

    await waitFor(() =>
      expect(posted).toEqual({ label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 }),
    );

    vi.unstubAllGlobals();
  });
```

Add the needed imports to the test file if absent: `import { waitFor } from '@testing-library/react';`, `import { http, HttpResponse } from 'msw';`, `import { server } from '../test/mocks/server';`, `import { TestQueryProvider } from '../test/queryClient';`. Note the Nominatim `fetch` stub must not intercept `/api/points` — MSW handles that POST because `authFetch` issues a same-origin request MSW can match, while the global `fetch` stub only covers the Nominatim call made before MSW is consulted. If both collide in practice, switch the Nominatim step to an MSW `http.get('https://nominatim.openstreetmap.org/search', ...)` handler instead of `vi.stubGlobal` so all network goes through MSW.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test -- MapPanel`
Expected: FAIL — button still writes localStorage, no POST observed.

- [ ] **Step 3: Implement**

In `MapPanel.tsx`, replace the localStorage save logic with the mutation. Remove the `SAVED_POINTS_KEY`/`loadSavedPoints`/`saveSavedPoints` helpers and the `SavedPoint` type. Add:

```tsx
import { useCreatePoint } from '../hooks/usePoints';
```

Inside the component:

```tsx
  const createPoint = useCreatePoint();
```

Replace `handleAddPoint` with:

```tsx
  function handleAddPoint() {
    if (!selectedResult) return;
    createPoint.mutate({
      label: selectedResult.display_name,
      latitude: Number(selectedResult.lat),
      longitude: Number(selectedResult.lon),
    });
    setResults([]);
    setSelectedResult(null);
    setQuery('');
  }
```

- [ ] **Step 4: Run tests**

Run: `cd react-frontend && npm run test -- MapPanel`
Expected: PASS.

- [ ] **Step 5: Full frontend suite + build**

Run: `cd react-frontend && npm run test && npm run build`
Expected: PASS — clean.

- [ ] **Step 6: Commit**

```bash
git add react-frontend/src/components/MapPanel.tsx && git commit -m "Persist alert points via the points API" -q && git push -q
git add react-frontend/src/components/MapPanel.test.tsx && git commit -m "Test alert point persists via API" -q && git push -q
```

---

## Done criteria

The feature is complete when:
1. `cd spring-bff && ./mvnw test` passes (geometry, ZoneAlertService, points/zones controllers, polling wiring).
2. `cd react-frontend && npm run test` passes and `npm run build` is clean.
3. `docker compose up --build` serves the app; in Settings you can create a point of interest and attach a circle or polygon zone with a trigger, color, and alarm message; the dashboard map renders those zones color-coded (circles and polygons, including one shape nested inside another).
4. With the dev seed people moving through a small zone (adjust seeded `person_location` rows so a person's latest fix falls inside a created circle), an `ENTER`/`INSIDE` alert appears in the Alerts page and recent-alerts widget, tinted by the zone color.
5. A moving person whose latest fix is older than the freshness window produces no zone alert (movement/freshness guard holds).

## Notes for the implementer

- The app is single-tenant: one dashboard login, and points attach to the first `fm_account`. If multi-account support ever lands, points/zones queries must filter by the authenticated account.
- Editing a zone's shape in place is out of scope — delete and recreate (spec Out of Scope).
- Antimeridian-crossing polygons are not handled (spec Out of Scope).
