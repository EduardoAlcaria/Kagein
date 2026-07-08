# react-frontend visual redesign (sub-project A)

## Purpose

Replace the hand-rolled Tailwind markup from the v1 build with real shadcn/ui
components (sidebar, cards, buttons, avatar menu), matching the quality of
shadcn's own reference dashboard blocks. Also lands the map's search/fullscreen
UX and the navigation skeleton for features that are designed but not built
yet (Alerts as its own page, "Previsão"/prediction placeholder) — see
`2026-07-08-findmy-dashboard-v2-roadmap.md` for the full B–F feature roadmap
this skeleton points at.

This is a visual/structural redesign, not a feature build. No new backend
endpoints. No real prediction or geofence logic — those are mocked or
stubbed, explicitly (see Out of Scope).

## Stack changes

- Adopt the official shadcn CLI (`npx shadcn@latest init`, then
  `npx shadcn@latest add sidebar card button avatar dropdown-menu input`) —
  pulls real component source into `src/components/ui/`, not hand-copied
  approximations. This is a build-time fetch from shadcn's registry, not a
  runtime script; nothing external loads when the deployed app runs.
- Adds `lib/utils.ts` (`cn()` helper via `clsx` + `tailwind-merge`, shadcn's
  standard convention) and `lucide-react` for icons — both installed
  automatically by the CLI.
- `components.json` (shadcn CLI config) — points at the existing
  `tailwind.config.js`/CSS-variable theme (Task 10's tweakcn tokens), so
  generated components pick up the same `background`/`primary`/`sidebar-*`
  etc. tokens already wired.
- No framework version change — still Tailwind v3, still Vite. shadcn's CLI
  supports both v3 (HSL/CSS-var config) and v4; we stay on v3.

## Navigation

`SidebarProvider` + `Sidebar` (`collapsible="icon"` — same collapse
behavior as the reference example) + `SidebarInset` for the main content
area. Header bar inside the inset holds the sidebar toggle + current page
title.

Nav items: **Dashboard** (`/`), **Alerts** (`/alerts`), **Previsão**
(`/prediction`), **Settings** (`/settings`). No team-switcher section (single
user, no teams) — sidebar header is just the app name.

Sidebar footer: logged-in username + a dropdown (shadcn `DropdownMenu`) with
Log out — replaces the plain header logout button from Task 10.

## Dashboard (`/`)

Three blocks, top to bottom:

1. **Per-person totalizer cards.** For each tracked person, up to two shadcn
   `Card`s: (a) chance they're at their own most-frequent/inferred location
   right now, (b) chance they're at a user-set point of interest right now
   (only rendered if that person has one). **Mocked data for this build** —
   F's real prediction engine doesn't exist yet; cards show a plausible
   fixed/random percentage so the final layout is correct now and needs no
   re-layout when F ships. Clicking a card navigates to
   `/prediction?personId=<id>`.
2. **Map + people sidebar** (existing `PeopleSidebar` + `MapView`, restyled
   with theme tokens), plus new map features:
   - **Fullscreen toggle** — expands `MapView` to cover the viewport.
   - **Address search** — a search input over the map, geocoding via
     Nominatim (OpenStreetMap's free, no-API-key geocoder:
     `https://nominatim.openstreetmap.org/search?format=json&q=<query>`).
     Selecting a result flies the map to that point and drops a marker.
   - **"Add as alert point"** — after selecting a search result, a button
     saves `{ label, latitude, longitude }` to `localStorage` under a
     `findmy.savedPoints` key. This is a stub: no backend call, no
     evaluation. Real persistence/evaluation lands with the geofencing
     project (E) in the roadmap doc.
3. **Recent alerts widget** — last 5 alerts (reuses `useAlerts()`) in a
   compact `Card`, with a "View all" link to `/alerts`.

## Alerts (`/alerts`)

New dedicated page. Full alert history (reuses `useAlerts()`, same data,
no new endpoint), rendered as a list of shadcn `Card`s or a simple table —
implementer's call, whichever composes better with the already-installed
components. Same data Task 7's `AlertsPanel` showed in a sidebar strip;
this page is the "see everything" view the roadmap's recent-alerts widget
links to.

## Settings (`/settings`)

Existing `AccountSettingsForm` (register Apple ID + 2FA flow, unchanged
logic from Task 8) restyled inside a shadcn `Card`, using shadcn `Input`/
`Button` instead of the raw `<input>`/`<button>` elements from Task 10.

## Previsão (`/prediction`)

Route-only skeleton for this build. Reads an optional `personId` query
param (set when a user clicks a Dashboard totalizer). Renders a shadcn
`Card` with "Coming soon" copy and, if `personId` is present, the selected
person's name. No chart, no map, no filter controls yet — those come with
the F project once the prediction engine exists (see roadmap doc for the
full page shape already agreed: person/point filter, probability chart,
routine chart, alternate-routes map).

## Testing

Same stack as v1 (Vitest + React Testing Library + MSW). New surfaces to
cover:
- Sidebar collapse toggle actually collapses/expands.
- Nav links route to the right page (`/`, `/alerts`, `/prediction`,
  `/settings`).
- Dashboard totalizer card click navigates to `/prediction?personId=<id>`.
- Map search: mock the Nominatim fetch (MSW), select a result, assert the
  "Add as alert point" flow writes to `localStorage`.
- Fullscreen toggle actually toggles the expanded state/class.
- Alerts page renders the full list from `useAlerts()`.
- Existing Task 1–10 tests (auth, API client, MapView markers/trail, alert
  banner, account form) must all still pass — this redesign changes
  presentation, not behavior, so no existing test's assertions about
  behavior should need to change (only ones asserting old raw Tailwind
  classes, if any — none currently do, tests query by role/label/text).

## Out of Scope (explicitly deferred to the roadmap doc)

- Real prediction engine / AI model (F) — totalizers and `/prediction` are
  mocked/placeholder only.
- Real geofence backend — circles/polygons/nested zones/per-zone alert
  types (E) are not built; the map's "add point" only writes to
  `localStorage`.
- Proximity alerts (B), movement pattern aggregation (C), travel-time
  estimates (D) — not touched in this build.
