# react-frontend design

## Purpose

Dashboard UI for the self-hosted Find My project. Single user, shows each shared person's
latest location on a map, location history/trail on demand, and stale-location alerts.
Talks only to spring-bff (never to Apple / python-findmy-service directly).

Backend contract (already built, confirmed):
- `POST /api/accounts` — register a Find My account (Apple ID + password, 2FA relay)
- `GET /api/alerts` — recent `AlertEventDto { id, personId, type, message, triggeredAt }`
- `GET /api/people` — `PersonSummaryDto { id, name, latest: PersonLocationDto | null }`
- `GET /api/people/{id}/locations` — `PersonLocationDto { latitude, longitude, capturedAt }[]`, most recent first
- Auth: HTTP Basic, single hardcoded dashboard user (`dashboard.username` / `dashboard.password-hash`)

## Stack

- Vite + React + TypeScript
- react-router — routing
- @tanstack/react-query — server state, caching, polling
- shadcn/ui — UI primitives
- mapcn (MapLibre GL under the hood) — map component
- Tailwind CSS

## API access: nginx reverse proxy

The frontend container serves the static build via nginx and reverse-proxies `/api/*` to
`spring-bff:8080`. Browser only ever talks to one origin. No CORS configuration needed on
spring-bff. Also means only one endpoint needs to be exposed through a tunnel later.

## Auth

- React context holds the dashboard username/password in memory only (never localStorage —
  avoids persisting the credential to disk).
- `authFetch` wrapper injects `Authorization: Basic <base64>` on every request.
- Any `401` response clears the context and redirects to `/login`.
- `/login` page: form for dashboard username/password (NOT the Apple ID — this authenticates
  against the dashboard itself). On success, populate context, navigate to `/`.
- `ProtectedRoute` wrapper: no credential in context → redirect to `/login`.

## Routes

- `/login` — dashboard login form
- `/` — main dashboard (map + sidebar + alerts)
- `/settings` — Find My account registration/status

## Pages and components

### `/` dashboard
- `MapView` — mapcn/MapLibre map. One marker per person using `GET /api/people`
  (react-query, `refetchInterval: 30_000`). Clicking a marker or a sidebar entry selects
  that person.
- `PeopleSidebar` — list of people with name + relative "last seen" time, highlights the
  selected person.
- Selecting a person fetches `GET /api/people/{id}/locations` and draws a trail (polyline)
  on the map plus a timeline list of past points.
- `AlertsPanel` — list of `GET /api/alerts` (react-query, `refetchInterval: 30_000`).
- Alert banner: track the highest alert `id` seen in `localStorage` (non-sensitive counter,
  fine to persist). New alerts with a higher id show a dismissible banner at the top.

### `/settings`
- `AccountSettingsForm` — Apple ID + password fields, submits to `POST /api/accounts`.
  If the response indicates 2FA is required, show a code input and resubmit. Displays
  current account status (active / pending 2FA / error).

### API client layer
- `api/client.ts` — one typed function per endpoint, built on `authFetch`. Mirrors the DTOs
  above exactly; no speculative fields.

## Deploy

- `react-frontend/Dockerfile` — multi-stage: `node` build stage (`npm run build`) →
  `nginx:alpine` serve stage, copies `dist/` and an `nginx.conf` that proxies `/api/` to
  `spring-bff:8080`.
- `docker-compose.yml` — new `react-frontend` service, `127.0.0.1:3000:80`,
  `depends_on: spring-bff`.

## Testing

- Vitest + React Testing Library.
- MSW to mock `/api/*` using the confirmed DTO shapes (no speculative response fields).
- Coverage: unauthenticated redirect to `/login`; map renders pins from mocked people list;
  selecting a person fetches and renders its trail; alert banner appears on a new alert id;
  settings form handles the 2FA follow-up step.

## Out of scope (YAGNI)

- No device-tracking UI (this project only tracks shared People/Friends, never the user's
  own devices).
- No push notifications — alerts are pull/poll only, in-app.
- No offline support / PWA.
- No multi-user support — single hardcoded dashboard user, matches spring-bff.
