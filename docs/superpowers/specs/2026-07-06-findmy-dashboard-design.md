# Find My Dashboard — Design Spec

Date: 2026-07-06
Status: Approved (pre-implementation)

## Overview

Personal dashboard that registers a single Apple ID and pulls location data
for the **people** who already share their location with that account —
the "People" tab of Apple's Find My app (family/friends location sharing),
not the account's own devices. Single user, self-hosted on a Mac mini,
local-first, tunneled to the internet later.

Motivation: understand the People/family-sharing side of the Find My
protocol well enough to build a better viewer than Apple's — richer
history and custom alerts (arrived/left, been stationary too long, stopped
updating) — without needing a physical iPhone on hand (auth happens
against Apple's cloud, not a local device).

## Goals

- Register an Apple ID (SRP login + 2FA) and keep the session alive.
- Pull everyone who shares their location with that Apple ID via Find My's
  People/family-sharing feature: name, current location, last-seen time.
- Store location history over time for each person (not just latest ping).
- Evaluate alert rules server-side (arrived/left an area, no update in N
  hours) since Apple's own app doesn't support custom alerting.
- Single-user dashboard, run locally first, safe to tunnel later.

## Non-goals (v1)

- Tracking the account's own devices (iPhone/Mac/AirTag/AirPods) — out of
  scope, this app is about people-sharing data only.
- Multi-tenant / multi-user auth on the dashboard.
- BLE offline-finding receiver (Mac mini as a Find My network node) — cloud
  polling only for now.
- iOS companion app (revisit once a physical iPhone is available).
- Local searchpartyd cache parsing (research side-quest, not on critical path).

## Architecture

Four services, docker-compose, local-first:

```
react-frontend  -->  spring-bff  -->  python-findmy-service  -->  anisette-server
                         |                    |
                         v                    v
                     Postgres (app schema)  Postgres (findmy_raw schema)
```

### python-findmy-service (Python)

Owns the reverse-engineered protocol. Responsibilities:
- Apple ID login: SRP auth + 2FA challenge/response.
- Anisette client: talks to the `anisette-server` container for device
  attestation headers Apple requires on every call.
- Fetch the People/family-sharing feed from Apple's Find My service —
  the same data Apple's app shows under the "People" tab — for everyone
  who currently shares their location with the registered Apple ID.
- Internal REST API (not internet-facing, only spring-bff calls it):
  - `POST /accounts` — start login (email+password)
  - `POST /accounts/{id}/2fa` — submit 2FA code
  - `GET /accounts/{id}/people` — list of people sharing location + latest
    position/last-seen
  - `GET /accounts/{id}/people/{personId}/locations` — location history
- Persists raw session/trust tokens (sensitive) in its own Postgres schema
  (`findmy_raw`), encrypted at rest with a server-side key from env config.

### spring-bff (Java, Spring Boot)

The only service the frontend talks to. Responsibilities:
- Dashboard auth: single-user login, JWT/session cookie.
- Orchestrates python-findmy-service calls (account registration, 2FA
  relay, on-demand refresh).
- Scheduler (`@Scheduled`) polls python-findmy-service at a configurable
  interval, upserts people + location history into Postgres (`app` schema).
- Alert engine: evaluates rules on each poll (geofence enter/exit, stale
  update) and records alert events.
- REST API for the frontend: accounts, people, locations/history, alerts.

### react-frontend (React + TypeScript)

- shadcn components with the supplied tweakcn theme.
- Map views via **mapcn**.
- Pages: Accounts (register + 2FA prompt), People (list, last-seen, status),
  Person detail (map + history timeline), Alerts (feed + rule settings).
- Talks only to spring-bff — never to python-findmy-service or Postgres
  directly.

### anisette-server

Existing open-source Docker image (SideStore-style anisette-v3-server).
Internal only, only python-findmy-service calls it.

### Postgres

Shared instance, two schemas:
- `findmy_raw` — python-findmy-service: session/trust tokens, anisette cache.
- `app` — spring-bff: accounts (dashboard-level), people, location
  history, alert rules, alert events.

## Data flow

1. User registers Apple ID in frontend → spring-bff → python-findmy-service
   starts SRP login.
2. If Apple challenges with 2FA, python-findmy-service returns a
   "2fa-required" status; spring-bff relays it to the frontend, which
   prompts for the code; code is submitted back through the same chain.
3. On success, python-findmy-service persists the session in `findmy_raw`.
4. spring-bff's scheduler polls python-findmy-service for the people feed
   on an interval, upserts into `app` schema, evaluates alert rules
   against the delta.
5. Frontend queries spring-bff for current people state, history, and
   alerts; renders map via mapcn.

## Error handling

- 2FA pending → explicit status code/shape the frontend recognizes and
  turns into a code-entry prompt.
- Apple rate-limiting / account lockout → backoff in python-findmy-service,
  surfaced as an account-level status the frontend can display.
- anisette-server unreachable → health check + retry with backoff; poll
  cycle skips that account and logs, doesn't crash the scheduler.
- Decrypt failure on a single report → log and skip that report; rest of
  the poll cycle continues.

## Deployment

- docker-compose bundles all five containers (frontend, bff, python
  service, anisette-server, postgres) for local run on the Mac mini.
- Later: front a tunnel (Cloudflare Tunnel or Tailscale funnel) only at
  spring-bff + react-frontend. python-findmy-service, anisette-server, and
  Postgres stay internal, never directly exposed.

## Testing strategy

- python-findmy-service: unit tests around the crypto/decrypt path (use
  known test vectors from prior art where available).
- spring-bff: unit tests for alert rule evaluation; integration tests for
  the scheduler + persistence using Testcontainers Postgres.
- react-frontend: light component tests; manual verification via running
  the app is acceptable for v1 (no heavy e2e suite).

## Implementation order

1. python-findmy-service (protocol core) + anisette-server wiring.
2. spring-bff (auth, orchestration, scheduler, alert engine, persistence).
3. react-frontend last, once backend/BFF APIs are stable.

## Open risks

- Apple's Find My network protocol is unofficial/reverse-engineered; it can
  change or trigger account flags without notice. Treat account lockout as
  an expected failure mode, not an edge case.
- Anisette emulation (non-jailbroken) is the single most fragile piece —
  confirm it works against the real Apple ID early (spike before building
  the rest of python-findmy-service).
