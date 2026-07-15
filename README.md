# FindMy Dashboard

Self-hosted "better Find My" — tracks family/friends via Apple ID People-tab
polling and shows them on a dashboard, with alerts and (planned) proximity/
geofencing/prediction features. Runs entirely on your own infrastructure, no
data leaves your machines.

## Architecture

Three services, wired together by `docker-compose.yml`:

- **python-findmy-service** — polls Apple's People endpoint using a stored
  Apple ID session (cookie-based), exposes internal REST routes for the BFF.
  Handles 2FA, per-account cookie isolation, rate-limiting.
- **spring-bff** — Java/Spring Boot backend. Owns Postgres, auth (dashboard
  login + credential encryption), alerts, and proxies location data from the
  Python service to the frontend.
- **react-frontend** — React/TypeScript/Vite dashboard SPA (shadcn/ui,
  Tailwind, MapLibre). Login, map view, people list, location history,
  alerts, settings.

```
react-frontend --> spring-bff --> python-findmy-service --> Apple
                        |
                     postgres
```

## Running it

Requires Docker. Set the required secrets as environment variables (or a
`.env` file next to `docker-compose.yml`):

```
INTERNAL_SERVICE_TOKEN=<shared secret between spring-bff and python-findmy-service>
POSTGRES_PASSWORD=<postgres password>
DASHBOARD_USERNAME=<dashboard login username>
DASHBOARD_PASSWORD_HASH=<bcrypt hash of dashboard login password>
CREDENTIAL_ENCRYPTION_KEY=<base64 key used to encrypt stored Apple ID credentials>
```

Then:

```
docker compose up --build
```

- Frontend: http://localhost:3000
- BFF: http://localhost:8080
- Python service: http://localhost:8000 (internal, bound to 127.0.0.1)

## Status

- `python-findmy-service` — complete.
- `spring-bff` — complete.
- `react-frontend` — base dashboard complete; visual redesign in progress
  (see `docs/superpowers/plans/`).

Roadmap (proximity alerts, movement history, travel-time estimates,
geofencing, AI-based prediction) is documented in
`docs/superpowers/specs/2026-07-08-findmy-dashboard-v2-roadmap.md`.

## Docs

Specs and implementation plans live under `docs/superpowers/` — each feature
gets a brainstorm/spec/plan cycle before implementation.
