# react-frontend Visual Redesign (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace react-frontend's hand-rolled Tailwind markup with real shadcn/ui components (sidebar, cards, buttons), add a collapsible icon sidebar with Dashboard/Alerts/Prediction/Settings nav, restyle every page, and land the map's fullscreen/search/add-point UX plus route skeletons for features designed but not built yet.

**Architecture:** Adopt the official shadcn CLI to pull real component source into `src/components/ui/`. Wrap the authenticated route tree in a new `AppLayout` (sidebar + header + `Outlet`) instead of each page managing its own nav. Existing hooks/API client/auth (Tasks 1-10 of the base react-frontend plan) are untouched — this is presentation and navigation structure only.

**Tech Stack:** Same as the base plan (Vite, React 18, TypeScript, react-router-dom, @tanstack/react-query, maplibre-gl, Tailwind v3), plus shadcn/ui components, `lucide-react` icons, `class-variance-authority`/`tailwind-merge`/`clsx` (shadcn's standard utility deps, auto-installed by its CLI), Nominatim (OpenStreetMap's free geocoder, no API key) for address search.

## Global Constraints

- This builds on top of the completed base react-frontend (`docs/superpowers/plans/2026-07-08-react-frontend.md`, all 10 tasks + Task 10's dark theme + the tweakcn retrofit already landed on `main`). Do not re-do that work.
- One file changed = one commit = one push (repo convention). No AI attribution in commit messages. Work directly on `main`.
- shadcn's CLI (`npx shadcn@latest add <component>`) fetches real, versioned component source from their registry at run time — this is a build-time dependency fetch, not something reproduced verbatim in this plan. The exact internal contents of generated `src/components/ui/*.tsx` files are NOT specified here; what IS fixed and must be verified by whoever runs the CLI is the **exported API surface** each task relies on (listed per task under "Interfaces: Consumes"). These are shadcn's stable, documented component names/props — if a generated file's exports differ from what's listed, stop and report the discrepancy rather than guessing.
- Theme tokens (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `sidebar`/`sidebar-foreground`/`sidebar-primary`/`sidebar-accent`/`sidebar-border`/`sidebar-ring`) already exist in `react-frontend/tailwind.config.js` and `react-frontend/src/index.css` (the tweakcn retrofit) — shadcn's generated components reference exactly these token names, no new CSS variables needed.
- No new backend endpoints. Per the design spec's explicit Out of Scope: no real prediction engine, no real geofence backend — totalizers are mocked, "add as alert point" only writes to `localStorage`.
- Directory: `react-frontend/` (existing).

---

## Task 1: Adopt shadcn CLI, install core primitives

**Files:**
- Create: `react-frontend/components.json`
- Create: `react-frontend/src/lib/utils.ts`
- Create (via CLI, not hand-authored): `react-frontend/src/components/ui/sidebar.tsx`, `react-frontend/src/components/ui/card.tsx`, `react-frontend/src/components/ui/button.tsx`, `react-frontend/src/components/ui/avatar.tsx`, `react-frontend/src/components/ui/dropdown-menu.tsx`, `react-frontend/src/components/ui/input.tsx`
- Modify: `react-frontend/package.json` (CLI adds dependencies automatically — do not hand-edit)

**Interfaces:**
- Produces: `cn()` from `src/lib/utils.ts`; and, from the CLI-installed `ui/` components, the following stable shadcn exports every later task consumes verbatim:
  - `ui/sidebar.tsx`: `Sidebar`, `SidebarProvider`, `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarHeader`, `SidebarFooter`, `SidebarInset`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarTrigger`, `useSidebar` (hook returning at least `{ state: 'expanded' | 'collapsed' }`, used in Task 2's collapse test)
  - `ui/card.tsx`: `Card`, `CardHeader`, `CardTitle`, `CardContent`
  - `ui/button.tsx`: `Button` (accepts standard `<button>` props plus `variant`)
  - `ui/avatar.tsx`: `Avatar`, `AvatarFallback`
  - `ui/dropdown-menu.tsx`: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
  - `ui/input.tsx`: `Input` (forwards standard `<input>` props including `aria-label`, `placeholder`, `value`, `onChange`, `type`)

- [ ] **Step 1: Write components.json (skips the interactive `shadcn init` wizard)**

```json
// react-frontend/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Write the `cn()` utility**

```ts
// react-frontend/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Run the CLI to fetch real components**

Run: `cd react-frontend && npx shadcn@latest add sidebar card button avatar dropdown-menu input --yes`
Expected: writes `src/components/ui/sidebar.tsx`, `card.tsx`, `button.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `input.tsx`, and installs `class-variance-authority`, `tailwind-merge`, `lucide-react`, and the `@radix-ui/react-*` packages those components need (into `package.json`/`package-lock.json` automatically).

- [ ] **Step 4: Verify the exported API surface matches what's listed above**

Run: `grep -E "^(export function|export const|function use)" react-frontend/src/components/ui/sidebar.tsx react-frontend/src/components/ui/card.tsx react-frontend/src/components/ui/button.tsx react-frontend/src/components/ui/avatar.tsx react-frontend/src/components/ui/dropdown-menu.tsx react-frontend/src/components/ui/input.tsx`
Expected: every symbol listed in this task's "Interfaces: Produces" section appears, including `useSidebar`. If any is missing or named differently, STOP and report — do not silently adjust later tasks' imports without flagging it first.

- [ ] **Step 5: Verify nothing regressed**

Run: `cd react-frontend && npm run test && npm run build`
Expected: all existing tests still pass (installing unused-so-far components changes no app behavior), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add react-frontend/components.json && git commit -m "Add shadcn components.json config" -q && git push -q
git add react-frontend/src/lib/utils.ts && git commit -m "Add shadcn cn() utility" -q && git push -q
git add react-frontend/package.json react-frontend/package-lock.json && git commit -m "Add shadcn CLI dependencies" -q && git push -q
git add react-frontend/src/components/ui/sidebar.tsx && git commit -m "Add shadcn sidebar component" -q && git push -q
git add react-frontend/src/components/ui/card.tsx && git commit -m "Add shadcn card component" -q && git push -q
git add react-frontend/src/components/ui/button.tsx && git commit -m "Add shadcn button component" -q && git push -q
git add react-frontend/src/components/ui/avatar.tsx && git commit -m "Add shadcn avatar component" -q && git push -q
git add react-frontend/src/components/ui/dropdown-menu.tsx && git commit -m "Add shadcn dropdown-menu component" -q && git push -q
git add react-frontend/src/components/ui/input.tsx && git commit -m "Add shadcn input component" -q && git push -q
```

---

## Task 2: AppSidebar + AppLayout, wired into App

**Files:**
- Create: `react-frontend/src/components/AppSidebar.tsx`
- Create: `react-frontend/src/components/AppSidebar.test.tsx`
- Create: `react-frontend/src/components/AppLayout.tsx`
- Create: `react-frontend/src/components/AppLayout.test.tsx`
- Modify: `react-frontend/src/App.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx` (remove the ad-hoc header added in the base plan's Task 10 fix — Settings link + Log out button move into the sidebar)

**Interfaces:**
- Consumes: `Sidebar`/`SidebarProvider`/`SidebarContent`/`SidebarGroup`/`SidebarGroupContent`/`SidebarHeader`/`SidebarFooter`/`SidebarInset`/`SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton`/`SidebarTrigger`/`useSidebar` (Task 1), `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` (Task 1), `Avatar`/`AvatarFallback` (Task 1), `useAuth()` (base plan Task 3), `useAlerts()` (base plan Task 7), `AlertBanner` (base plan Task 7), `TestQueryProvider` (base plan Task 4, used in `AppLayout.test.tsx`).
- Produces: `AppSidebar` (no props), `AppLayout` (no props, renders `<Outlet/>`) — Tasks 3-7 render inside `AppLayout` via routing, not directly.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/AppSidebar.test.tsx
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { clearCredential, getCredential, setCredential } from '../auth/credentialStore';
import { SidebarProvider } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';

function renderSidebar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('AppSidebar', () => {
  afterEach(() => clearCredential());

  it('renders every nav item with its route', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Alerts/ })).toHaveAttribute('href', '/alerts');
    expect(screen.getByRole('link', { name: /Previsão/ })).toHaveAttribute('href', '/prediction');
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/settings');
  });

  it('shows the logged-in username and logs out on click', async () => {
    setCredential({ username: 'admin', password: 'hunter2' });
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByText('admin')).toBeInTheDocument();

    await user.click(screen.getByText('admin'));
    await user.click(await screen.findByText('Log out'));

    expect(getCredential()).toBeNull();
  });
});
```

```tsx
// react-frontend/src/components/AppLayout.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { AuthProvider } from '../auth/AuthContext';
import { useSidebar } from './ui/sidebar';
import { AppLayout } from './AppLayout';

function SidebarState() {
  const { state } = useSidebar();
  return <div data-testid="sidebar-state">{state}</div>;
}

describe('AppLayout', () => {
  it('toggles the sidebar collapsed/expanded state via the trigger', async () => {
    server.use(http.get('/api/alerts', () => HttpResponse.json([])));

    const user = userEvent.setup();
    render(
      <TestQueryProvider>
        <AuthProvider>
          <MemoryRouter>
            <Routes>
              <Route
                element={
                  <>
                    <AppLayout />
                    <SidebarState />
                  </>
                }
              >
                <Route path="/" element={<div>Dashboard content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </TestQueryProvider>,
    );

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');

    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
  });
});
```

Note: `SidebarTrigger`'s accessible name comes from shadcn's generated component (typically an icon button with a screen-reader-only "Toggle Sidebar" label). If Task 1's Step 4 verification finds a different accessible name, adjust the `getByRole` query above to match — don't guess before checking the real generated file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `AppSidebar`/`AppLayout` modules don't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/AppSidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import { Bell, LayoutDashboard, LogOut, Settings, Sparkles } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/prediction', label: 'Previsão', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { credential, logout } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="px-2 text-sm font-semibold text-sidebar-foreground">Find My Dashboard</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton>
              <Avatar className="h-6 w-6">
                <AvatarFallback>{credential?.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <span>{credential?.username}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top">
            <DropdownMenuItem onClick={logout}>
              <LogOut />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
```

```tsx
// react-frontend/src/components/AppLayout.tsx
import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AlertBanner } from './AlertBanner';
import { useAlerts } from '../hooks/useAlerts';

export function AppLayout() {
  const { data: alerts } = useAlerts();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AlertBanner alerts={alerts ?? []} />
        <header className="flex items-center gap-2 border-b border-border px-4 py-2">
          <SidebarTrigger />
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

```tsx
// react-frontend/src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

(`/alerts` and `/prediction` routes are added in Tasks 3-4 — `App.tsx` is modified again there.)

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';

export function DashboardPage() {
  const { data: people } = usePeople();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <PeopleSidebar
        people={people ?? []}
        selectedPersonId={selectedPersonId}
        onSelectPerson={setSelectedPersonId}
      />
      <div className="flex-1">
        <MapView
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
          trail={locations ?? []}
        />
      </div>
      {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
    </div>
  );
}
```

(This strips the alert banner, alerts panel, and header nav out of `DashboardPage` — the banner now lives in `AppLayout`, the alerts panel is replaced by the `/alerts` page and a recent-alerts widget in Tasks 4 and 7, and the header nav is now the sidebar. `100vh-49px` accounts for the `AppLayout` header's height so the map fills the rest of the viewport — adjust if the header's actual rendered height differs; verify visually.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: `AppSidebar` tests pass. `DashboardPage.test.tsx`'s existing "shows the alert banner for a new alert" test will now FAIL (the banner moved to `AppLayout`) — this is expected; fix it in Task 7 when `DashboardPage.test.tsx` is next modified. Note the failure and continue; do not leave the suite red at the end of this task — remove that one now-obsolete test in this same step since it directly contradicts this task's own change (the alert banner is verified in `AppLayout`'s context here, not `DashboardPage`'s):

```tsx
// react-frontend/src/pages/DashboardPage.test.tsx
// Remove the "shows the alert banner for a new alert" test block (server.use(...) mocking
// /api/alerts) — DashboardPage no longer renders AlertBanner. The other two tests
// (people sidebar, location history) are unaffected and should still pass unchanged.
```

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/AppSidebar.tsx && git commit -m "Add AppSidebar navigation" -q && git push -q
git add react-frontend/src/components/AppSidebar.test.tsx && git commit -m "Add AppSidebar tests" -q && git push -q
git add react-frontend/src/components/AppLayout.tsx && git commit -m "Add AppLayout wrapping sidebar and outlet" -q && git push -q
git add react-frontend/src/components/AppLayout.test.tsx && git commit -m "Add AppLayout sidebar collapse test" -q && git push -q
git add react-frontend/src/App.tsx && git commit -m "Wire AppLayout into App routing" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Strip nav/banner/alerts-panel out of DashboardPage" -q && git push -q
git add react-frontend/src/pages/DashboardPage.test.tsx && git commit -m "Remove obsolete alert-banner test from DashboardPage" -q && git push -q
```

---

## Task 3: Prediction page skeleton

**Files:**
- Create: `react-frontend/src/pages/PredictionPage.tsx`
- Create: `react-frontend/src/pages/PredictionPage.test.tsx`
- Modify: `react-frontend/src/App.tsx` (add the `/prediction` route)

**Interfaces:**
- Consumes: `usePeople()` (base plan Task 4), `Card`/`CardHeader`/`CardTitle`/`CardContent` (Task 1).
- Produces: `PredictionPage` — Task 6's totalizer cards link to `/prediction?personId=<id>`, which this page reads.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/pages/PredictionPage.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { PredictionPage } from './PredictionPage';

function renderAt(path: string) {
  return render(
    <TestQueryProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/prediction" element={<PredictionPage />} />
        </Routes>
      </MemoryRouter>
    </TestQueryProvider>,
  );
}

describe('PredictionPage', () => {
  it('shows a coming-soon message for the selected person', async () => {
    server.use(http.get('/api/people', () => HttpResponse.json([{ id: 1, name: 'Jane Doe', latest: null }])));

    renderAt('/prediction?personId=1');

    expect(await screen.findByText('Coming soon for Jane Doe.')).toBeInTheDocument();
  });

  it('shows a generic message with no person selected', () => {
    renderAt('/prediction');

    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `PredictionPage` module doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/pages/PredictionPage.tsx
import { useSearchParams } from 'react-router-dom';
import { usePeople } from '../hooks/usePeople';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function PredictionPage() {
  const [searchParams] = useSearchParams();
  const personId = searchParams.get('personId');
  const { data: people } = usePeople();
  const person = people?.find((p) => String(p.id) === personId);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Previsão</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {person ? `Coming soon for ${person.name}.` : 'Coming soon.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

```tsx
// react-frontend/src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { PredictionPage } from './pages/PredictionPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/prediction" element={<PredictionPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/pages/PredictionPage.tsx && git commit -m "Add Prediction page skeleton" -q && git push -q
git add react-frontend/src/pages/PredictionPage.test.tsx && git commit -m "Add Prediction page tests" -q && git push -q
git add react-frontend/src/App.tsx && git commit -m "Wire /prediction route into App" -q && git push -q
```

---

## Task 4: Alerts page (replaces the AlertsPanel side-strip)

**Files:**
- Create: `react-frontend/src/pages/AlertsPage.tsx`
- Create: `react-frontend/src/pages/AlertsPage.test.tsx`
- Delete: `react-frontend/src/components/AlertsPanel.tsx`
- Delete: `react-frontend/src/components/AlertsPanel.test.tsx`
- Modify: `react-frontend/src/App.tsx` (add the `/alerts` route)

**Interfaces:**
- Consumes: `useAlerts()` (base plan Task 7), `Card`/`CardHeader`/`CardTitle`/`CardContent` (Task 1).
- Produces: `AlertsPage` — Task 7's recent-alerts widget links to `/alerts`.

`AlertsPanel` is deleted, not kept, because its job (showing the alert list) is now split between this full-page view and Task 7's dashboard widget — keeping it around would be a third, unused way to render the same data (repo already has enough surfaces reading `useAlerts()`; don't add a fourth).

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/pages/AlertsPage.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { TestQueryProvider } from '../test/queryClient';
import { AlertsPage } from './AlertsPage';

describe('AlertsPage', () => {
  it('renders the full alert history', async () => {
    server.use(
      http.get('/api/alerts', () =>
        HttpResponse.json([
          { id: 1, personId: 1, type: 'STALE_UPDATE', message: 'Jane is stale', triggeredAt: '2026-07-06T12:00:00Z' },
          { id: 2, personId: 2, type: 'STALE_UPDATE', message: 'John is stale', triggeredAt: '2026-07-06T13:00:00Z' },
        ]),
      ),
    );

    render(
      <TestQueryProvider>
        <AlertsPage />
      </TestQueryProvider>,
    );

    expect(await screen.findByText('Jane is stale')).toBeInTheDocument();
    expect(screen.getByText('John is stale')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `AlertsPage` module doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/pages/AlertsPage.tsx
import { useAlerts } from '../hooks/useAlerts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function AlertsPage() {
  const { data: alerts } = useAlerts();

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {(alerts ?? []).map((alert) => (
              <li key={alert.id} className="border-b border-border py-2 text-sm last:border-b-0">
                <div className="font-medium">{alert.type}</div>
                <div className="text-muted-foreground">{alert.message}</div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

```tsx
// react-frontend/src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { AlertsPage } from './pages/AlertsPage';
import { PredictionPage } from './pages/PredictionPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/prediction" element={<PredictionPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green (deleting `AlertsPanel`/`AlertsPanel.test.tsx` removes those tests entirely; nothing else imports `AlertsPanel` after Task 2 already stripped it out of `DashboardPage`).

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/pages/AlertsPage.tsx && git commit -m "Add Alerts page" -q && git push -q
git add react-frontend/src/pages/AlertsPage.test.tsx && git commit -m "Add Alerts page tests" -q && git push -q
git rm react-frontend/src/components/AlertsPanel.tsx && git commit -m "Remove AlertsPanel, superseded by Alerts page and dashboard widget" -q && git push -q
git rm react-frontend/src/components/AlertsPanel.test.tsx && git commit -m "Remove AlertsPanel tests" -q && git push -q
git add react-frontend/src/App.tsx && git commit -m "Wire /alerts route into App" -q && git push -q
```

---

## Task 5: Restyle Login/Settings pages and AccountSettingsForm with shadcn components

**Files:**
- Modify: `react-frontend/src/pages/LoginPage.tsx`
- Modify: `react-frontend/src/pages/SettingsPage.tsx`
- Modify: `react-frontend/src/components/AccountSettingsForm.tsx`

**Interfaces:**
- Consumes: `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Button`, `Input` (Task 1).
- Produces: no new exports — same components, restyled markup only. `AccountSettingsForm.test.tsx` and `LoginPage`'s usage in `auth.test.tsx` are unaffected since they query by `getByLabelText`/`getByRole`, and shadcn's `Input`/`Button` forward those props straight through to the native element.

- [ ] **Step 1: Restyle LoginPage**

```tsx
// react-frontend/src/pages/LoginPage.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login({ username, password });
    navigate('/', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-80">
        <CardHeader>
          <CardTitle>Find My Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              aria-label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <Input
              aria-label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <Button type="submit">Log in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Restyle SettingsPage**

```tsx
// react-frontend/src/pages/SettingsPage.tsx
import { AccountSettingsForm } from '../components/AccountSettingsForm';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function SettingsPage() {
  return (
    <div className="flex justify-center p-6">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Find My Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Restyle AccountSettingsForm**

```tsx
// react-frontend/src/components/AccountSettingsForm.tsx
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { registerAccount, submitTwoFactorCode } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function AccountSettingsForm() {
  const [appleId, setAppleId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'active' | '2fa_required'>('idle');

  const registerMutation = useMutation({
    mutationFn: () => registerAccount({ appleId, password }),
    onSuccess: (response) => setStatus(response.status),
  });

  const twoFactorMutation = useMutation({
    mutationFn: () => submitTwoFactorCode(appleId, code),
    onSuccess: (response) => setStatus(response.status),
  });

  function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    registerMutation.mutate();
  }

  function handleTwoFactorSubmit(event: FormEvent) {
    event.preventDefault();
    twoFactorMutation.mutate();
  }

  if (status === '2fa_required') {
    return (
      <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-4">
        <p className="text-muted-foreground">Enter the 2FA code sent to your Apple devices.</p>
        <Input aria-label="2FA code" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" disabled={twoFactorMutation.isPending}>
          {twoFactorMutation.isPending ? 'Submitting...' : 'Submit code'}
        </Button>
        {twoFactorMutation.isError && <p className="text-destructive">Couldn't verify that code. Try again.</p>}
      </form>
    );
  }

  return (
    <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
      <Input
        aria-label="Apple ID"
        value={appleId}
        onChange={(e) => setAppleId(e.target.value)}
        placeholder="Apple ID"
      />
      <Input
        aria-label="Apple ID password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <Button type="submit" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? 'Adding...' : 'Add account'}
      </Button>
      {status === 'active' && <p className="text-primary">Account active.</p>}
      {registerMutation.isError && (
        <p className="text-destructive">Couldn't add that account. Check the Apple ID and password.</p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `cd react-frontend && npm run test`
Expected: PASS — `auth.test.tsx` (types into `Username`/`Password` via label), `AccountSettingsForm.test.tsx` (types into `Apple ID`/`Apple ID password`/`2FA code`, clicks `Add account`/`Submit code`) all still pass since the underlying accessible names/roles didn't change.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/pages/LoginPage.tsx && git commit -m "Restyle LoginPage with shadcn components" -q && git push -q
git add react-frontend/src/pages/SettingsPage.tsx && git commit -m "Restyle SettingsPage with shadcn Card" -q && git push -q
git add react-frontend/src/components/AccountSettingsForm.tsx && git commit -m "Restyle AccountSettingsForm with shadcn Input/Button" -q && git push -q
```

---

## Task 6: Dashboard prediction totalizers (mocked)

**Files:**
- Create: `react-frontend/src/components/PredictionTotalizers.tsx`
- Create: `react-frontend/src/components/PredictionTotalizers.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `PersonSummaryDto` (`api/types.ts`), `Card`/`CardHeader`/`CardTitle`/`CardContent` (Task 1).
- Produces: `PredictionTotalizers({ people })` — renders one card per person, navigates to `/prediction?personId=<id>` on click.

Per the design spec's roadmap, each person could eventually get two totalizer
cards (most-frequent-location and a user-assigned point of interest). This
build only implements the first — there's no mechanism yet to assign a point
of interest to a specific person (that's part of the geofencing project, E,
in the roadmap doc), so a second card with no way to ever populate it would
be dead UI. Add the second card when that assignment feature exists.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/PredictionTotalizers.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PredictionTotalizers } from './PredictionTotalizers';

const people = [
  { id: 1, name: 'Jane Doe', latest: null },
  { id: 2, name: 'John Smith', latest: null },
];

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

describe('PredictionTotalizers', () => {
  it('renders one card per person with a mocked percentage', () => {
    render(
      <MemoryRouter>
        <PredictionTotalizers people={people} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getAllByText(/^\d+%$/)).toHaveLength(2);
  });

  it('navigates to the prediction page for the clicked person', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <PredictionTotalizers people={people} />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Jane Doe'));

    expect(screen.getByTestId('location')).toHaveTextContent('/prediction?personId=1');
  });

  it('renders nothing when there are no people', () => {
    const { container } = render(
      <MemoryRouter>
        <PredictionTotalizers people={[]} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `PredictionTotalizers` module doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/PredictionTotalizers.tsx
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { PersonSummaryDto } from '../api/types';

function mockProbability(seed: number): number {
  return ((seed * 37) % 60) + 20;
}

export function PredictionTotalizers({ people }: { people: PersonSummaryDto[] }) {
  const navigate = useNavigate();

  if (people.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {people.map((person) => (
        <Card
          key={person.id}
          className="cursor-pointer"
          onClick={() => navigate(`/prediction?personId=${person.id}`)}
        >
          <CardHeader>
            <CardTitle className="text-sm">{person.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{mockProbability(person.id)}%</p>
            <p className="text-xs text-muted-foreground">chance at usual location now</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { PredictionTotalizers } from '../components/PredictionTotalizers';

export function DashboardPage() {
  const { data: people } = usePeople();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex flex-col">
      <PredictionTotalizers people={people ?? []} />
      <div className="flex h-[60vh]">
        <PeopleSidebar
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
        />
        <div className="flex-1">
          <MapView
            people={people ?? []}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            trail={locations ?? []}
          />
        </div>
        {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/PredictionTotalizers.tsx && git commit -m "Add PredictionTotalizers with mocked probabilities" -q && git push -q
git add react-frontend/src/components/PredictionTotalizers.test.tsx && git commit -m "Add PredictionTotalizers tests" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire PredictionTotalizers into DashboardPage" -q && git push -q
```

---

## Task 7: Dashboard recent-alerts widget

**Files:**
- Create: `react-frontend/src/components/RecentAlertsWidget.tsx`
- Create: `react-frontend/src/components/RecentAlertsWidget.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `AlertEventDto` (`api/types.ts`), `useAlerts()` (base plan Task 7), `Card`/`CardHeader`/`CardTitle`/`CardContent` (Task 1).
- Produces: `RecentAlertsWidget({ alerts })` — shows up to 5, links to `/alerts` (Task 4).

`useAlerts()` returns alerts already sorted most-recent-first (spring-bff's
`findTop100ByOrderByTriggeredAtDesc`), so `.slice(0, 5)` is correct without
any client-side re-sorting.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/RecentAlertsWidget.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecentAlertsWidget } from './RecentAlertsWidget';

describe('RecentAlertsWidget', () => {
  it('shows at most 5 alerts and a link to the full list', () => {
    const alerts = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      personId: 1,
      type: 'STALE_UPDATE',
      message: `Alert ${i + 1}`,
      triggeredAt: '2026-07-06T12:00:00Z',
    }));

    render(
      <MemoryRouter>
        <RecentAlertsWidget alerts={alerts} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Alert 1')).toBeInTheDocument();
    expect(screen.getByText('Alert 5')).toBeInTheDocument();
    expect(screen.queryByText('Alert 6')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/alerts');
  });

  it('shows an empty state with no alerts', () => {
    render(
      <MemoryRouter>
        <RecentAlertsWidget alerts={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('No alerts yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `RecentAlertsWidget` module doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/RecentAlertsWidget.tsx
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { AlertEventDto } from '../api/types';

export function RecentAlertsWidget({ alerts }: { alerts: AlertEventDto[] }) {
  const recent = alerts.slice(0, 5);

  return (
    <Card className="m-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Recent alerts</CardTitle>
        <Link to="/alerts" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((alert) => (
              <li key={alert.id} className="text-sm">
                {alert.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapView } from '../components/MapView';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { PredictionTotalizers } from '../components/PredictionTotalizers';
import { RecentAlertsWidget } from '../components/RecentAlertsWidget';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex flex-col">
      <PredictionTotalizers people={people ?? []} />
      <div className="flex h-[60vh]">
        <PeopleSidebar
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
        />
        <div className="flex-1">
          <MapView
            people={people ?? []}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            trail={locations ?? []}
          />
        </div>
        {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
      </div>
      <RecentAlertsWidget alerts={alerts ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/RecentAlertsWidget.tsx && git commit -m "Add RecentAlertsWidget" -q && git push -q
git add react-frontend/src/components/RecentAlertsWidget.test.tsx && git commit -m "Add RecentAlertsWidget tests" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire RecentAlertsWidget into DashboardPage" -q && git push -q
```

---

## Task 8: MapPanel — fullscreen toggle

**Files:**
- Create: `react-frontend/src/components/MapPanel.tsx`
- Create: `react-frontend/src/components/MapPanel.test.tsx`
- Modify: `react-frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `MapView` (base plan Task 5, unchanged), `Button` (Task 1).
- Produces: `MapPanel({ people, selectedPersonId, onSelectPerson, trail })` — same props as `MapView`, wraps it. Tasks 9-10 extend this same file.

- [ ] **Step 1: Write the failing test**

```tsx
// react-frontend/src/components/MapPanel.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPanel } from './MapPanel';

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    remove: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn(() => undefined),
  })),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getElement: () => document.createElement('div'),
  })),
}));

describe('MapPanel', () => {
  it('toggles fullscreen', async () => {
    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.click(screen.getByRole('button', { name: 'Fullscreen' }));

    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));

    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — `MapPanel` module doesn't exist yet.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/MapPanel.tsx
import { useState } from 'react';
import { Button } from './ui/button';
import { MapView } from './MapView';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail }: MapPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative h-full w-full'}>
      <div className="absolute left-2 top-2 z-10">
        <Button type="button" variant="outline" onClick={() => setIsFullscreen((v) => !v)}>
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </Button>
      </div>
      <MapView
        people={people}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        trail={trail}
      />
    </div>
  );
}
```

```tsx
// react-frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { usePeople } from '../hooks/usePeople';
import { usePersonLocations } from '../hooks/usePersonLocations';
import { useAlerts } from '../hooks/useAlerts';
import { PeopleSidebar } from '../components/PeopleSidebar';
import { MapPanel } from '../components/MapPanel';
import { LocationHistoryList } from '../components/LocationHistoryList';
import { PredictionTotalizers } from '../components/PredictionTotalizers';
import { RecentAlertsWidget } from '../components/RecentAlertsWidget';

export function DashboardPage() {
  const { data: people } = usePeople();
  const { data: alerts } = useAlerts();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const { data: locations } = usePersonLocations(selectedPersonId);

  return (
    <div className="flex flex-col">
      <PredictionTotalizers people={people ?? []} />
      <div className="flex h-[60vh]">
        <PeopleSidebar
          people={people ?? []}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPersonId}
        />
        <div className="flex-1">
          <MapPanel
            people={people ?? []}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            trail={locations ?? []}
          />
        </div>
        {selectedPersonId !== null && <LocationHistoryList locations={locations ?? []} />}
      </div>
      <RecentAlertsWidget alerts={alerts ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green. `DashboardPage.test.tsx` and `MapView.test.tsx` both still mock `maplibre-gl` at the module level, so `MapPanel` rendering `MapView` under the hood doesn't need any changes there.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/MapPanel.tsx && git commit -m "Add MapPanel with fullscreen toggle" -q && git push -q
git add react-frontend/src/components/MapPanel.test.tsx && git commit -m "Add MapPanel fullscreen test" -q && git push -q
git add react-frontend/src/pages/DashboardPage.tsx && git commit -m "Wire MapPanel into DashboardPage" -q && git push -q
```

---

## Task 9: MapPanel — address search via Nominatim

**Files:**
- Modify: `react-frontend/src/components/MapPanel.tsx`
- Modify: `react-frontend/src/components/MapPanel.test.tsx`

**Interfaces:**
- Consumes: `Input` (Task 1).
- Produces: no new exports — `MapPanel`'s props are unchanged; this adds internal UI only.

- [ ] **Step 1: Write the failing test**

Append to the existing `describe('MapPanel', ...)` block in `react-frontend/src/components/MapPanel.test.tsx`:

```tsx
  it('searches an address via Nominatim and lists results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
        ),
      ),
    );

    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Eiffel Tower, Paris')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — no search input/button exist yet in `MapPanel`.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/MapPanel.tsx
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapView } from './MapView';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail }: MapPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);

  async function handleSearch() {
    if (!query.trim()) return;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
    );
    const data: NominatimResult[] = await response.json();
    setResults(data);
  }

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative h-full w-full'}>
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            aria-label="Search address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address"
            className="w-64"
          />
          <Button type="button" onClick={handleSearch}>
            Search
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsFullscreen((v) => !v)}>
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
        </div>
        {results.length > 0 && (
          <ul className="max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {results.map((result) => (
              <li key={result.display_name}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <MapView
        people={people}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        trail={trail}
      />
    </div>
  );
}
```

(The result-row `<button>` has no `onClick` yet — Task 10 wires selection + "Add as alert point".)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add react-frontend/src/components/MapPanel.tsx && git commit -m "Add Nominatim address search to MapPanel" -q && git push -q
git add react-frontend/src/components/MapPanel.test.tsx && git commit -m "Add MapPanel search test" -q && git push -q
```

---

## Task 10: MapPanel — "Add as alert point" (localStorage stub)

**Files:**
- Modify: `react-frontend/src/components/MapPanel.tsx`
- Modify: `react-frontend/src/components/MapPanel.test.tsx`

**Interfaces:**
- Produces: writes to `localStorage` key `findmy.savedPoints` — a JSON array of `{ label: string, latitude: number, longitude: number }`. No later task in this plan reads it back; the geofencing project (E, roadmap doc) is what turns this into something the backend evaluates.

- [ ] **Step 1: Write the failing test**

Append to the existing `describe('MapPanel', ...)` block in `react-frontend/src/components/MapPanel.test.tsx`, and add `beforeEach`/`afterEach` localStorage cleanup:

```tsx
  it('selects a search result and saves it as an alert point', async () => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ display_name: 'Eiffel Tower, Paris', lat: '48.8584', lon: '2.2945' }]),
        ),
      ),
    );

    const user = userEvent.setup();
    render(<MapPanel people={[]} selectedPersonId={null} onSelectPerson={vi.fn()} trail={[]} />);

    await user.type(screen.getByLabelText('Search address'), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByText('Eiffel Tower, Paris'));
    await user.click(screen.getByRole('button', { name: 'Add as alert point' }));

    const saved = JSON.parse(localStorage.getItem('findmy.savedPoints') ?? '[]');
    expect(saved).toEqual([{ label: 'Eiffel Tower, Paris', latitude: 48.8584, longitude: 2.2945 }]);

    vi.unstubAllGlobals();
    localStorage.clear();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd react-frontend && npm run test`
Expected: FAIL — no "Add as alert point" button exists yet, result rows aren't selectable.

- [ ] **Step 3: Implement**

```tsx
// react-frontend/src/components/MapPanel.tsx
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MapView } from './MapView';
import type { PersonLocationDto, PersonSummaryDto } from '../api/types';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SavedPoint {
  label: string;
  latitude: number;
  longitude: number;
}

const SAVED_POINTS_KEY = 'findmy.savedPoints';

function loadSavedPoints(): SavedPoint[] {
  const stored = localStorage.getItem(SAVED_POINTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveSavedPoints(points: SavedPoint[]): void {
  localStorage.setItem(SAVED_POINTS_KEY, JSON.stringify(points));
}

interface MapPanelProps {
  people: PersonSummaryDto[];
  selectedPersonId: number | null;
  onSelectPerson: (personId: number) => void;
  trail: PersonLocationDto[];
}

export function MapPanel({ people, selectedPersonId, onSelectPerson, trail }: MapPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<NominatimResult | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
    );
    const data: NominatimResult[] = await response.json();
    setResults(data);
  }

  function handleAddPoint() {
    if (!selectedResult) return;
    const points = loadSavedPoints();
    points.push({
      label: selectedResult.display_name,
      latitude: Number(selectedResult.lat),
      longitude: Number(selectedResult.lon),
    });
    saveSavedPoints(points);
    setResults([]);
    setSelectedResult(null);
    setQuery('');
  }

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative h-full w-full'}>
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            aria-label="Search address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address"
            className="w-64"
          />
          <Button type="button" onClick={handleSearch}>
            Search
          </Button>
          <Button type="button" variant="outline" onClick={() => setIsFullscreen((v) => !v)}>
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
        </div>
        {results.length > 0 && (
          <ul className="max-h-48 w-64 overflow-y-auto rounded-lg border border-border bg-card p-2">
            {results.map((result) => (
              <li key={result.display_name}>
                <button
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  className="w-full rounded px-2 py-1 text-left text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedResult && (
          <Button type="button" onClick={handleAddPoint}>
            Add as alert point
          </Button>
        )}
      </div>
      <MapView
        people={people}
        selectedPersonId={selectedPersonId}
        onSelectPerson={onSelectPerson}
        trail={trail}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd react-frontend && npm run test`
Expected: PASS — all tests green.

- [ ] **Step 5: Run the full build**

Run: `cd react-frontend && npm run build`
Expected: clean, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add react-frontend/src/components/MapPanel.tsx && git commit -m "Add 'Add as alert point' localStorage stub to MapPanel" -q && git push -q
git add react-frontend/src/components/MapPanel.test.tsx && git commit -m "Add MapPanel add-point test" -q && git push -q
```

---

## Done criteria

The redesign is complete when:
1. `cd react-frontend && npm run test` passes every task's tests.
2. `npm run build` produces a clean `dist/` bundle.
3. `docker compose up --build react-frontend spring-bff postgres python-findmy-service` serves the app; logging in shows a collapsible icon sidebar (Dashboard/Alerts/Previsão/Settings), the Dashboard shows mocked per-person totalizer cards + map (search/fullscreen/add-point working) + a recent-alerts widget linking to `/alerts`, the Alerts page shows full history, Settings shows the restyled account form, and `/prediction` shows the coming-soon skeleton.
4. Visual spot-check in a real browser (e.g. via Playwright) confirms the sidebar collapse toggle, dropdown user menu, and theme tokens render correctly against the tweakcn dark theme already in place.
