# Find My Dashboard — Design Spec

Date: 2026-07-06
Status: Approved (pre-implementation)

## Overview

Personal dashboard that registers a single Apple ID and pulls location data
for the **people** who already share their location with that account —
the "People" tab of Apple's Find My app (family/friends location sharing),
not the account's own devices. Single user, self-hosted on a Mac mini,
local-first, tunneled to the internet later.

Motivation: build a better viewer than Apple's own People tab — richer
history and custom alerts (arrived/left, been stationary too long, stopped
updating) — using the existing iCloud web session Apple's Find My app
itself uses, no physical iPhone needed (auth happens against Apple's
cloud, not a local device).

## Goals

- Register an Apple ID (iCloud web login + 2FA) and keep the session alive.
- Pull everyone who shares their location with that Apple ID via Find My's
  People/family-sharing feature: name, current location, last-seen time.
- Store location history over time for each person (not just latest ping).
- Evaluate alert rules server-side since Apple's own app doesn't support
  custom alerting. v1 ships stale-update detection only (no location
  update in N hours) — see Non-goals for what's deferred.
- Single-user dashboard, run locally first, safe to tunnel later.

## Non-goals (v1)

- Geofence-based alerts (arrived/left an area) — deferred. Needs its own
  design pass (per-person area, global area, drawn on the map?) once
  there's real location history to design the UX against; guessing at it
  before that exists would be speculative. v1 alerting is stale-update
  only.
- Tracking the account's own devices (iPhone/Mac/AirTag/AirPods) — out of
  scope, this app is about people-sharing data only.
- AirTag / offline-finding BLE network protocol — that's a different,
  heavier Apple protocol (device attestation via "anisette", encrypted
  report decryption) that only applies to device tracking, not to People
  tab data. Not needed here.
- Multi-tenant / multi-user auth on the dashboard.
- iOS companion app (revisit once a physical iPhone is available).

## Protocol notes (why this is simpler than device tracking)

Apple's Find My app actually talks to two distinct backend services:

1. **Device tracking** ("Find My iPhone" / AirTag / offline-finding) — the
   heavy, cryptographic protocol: device-specific key material, Apple
   device attestation ("anisette") headers, encrypted location reports
   that must be decrypted client-side. This is what OpenHaystack/FindMy.py
   reverse-engineered. **Not used here.**
2. **People sharing** ("Find My Friends", still called `fmf` internally) —
   a plain iCloud web-session API. Once logged into icloud.com (the same
   session pyicloud already establishes for iCloud Drive/Photos/etc.),
   the friends endpoint is a single authenticated POST, no device
   attestation, no client-side decryption:
   - Webservice root: read from the account's webservices map under the
     key `fmf` after login (same pattern pyicloud uses for `findme`).
   - Endpoint: `POST {fmf_root}/fmipservice/client/fmfWeb/initClient`
   - Response: list of friends, each with an `id` and a `location` object
     containing `latitude`, `longitude`, `timestamp` (ms epoch),
     `altitude`, `horizontalAccuracy`, `verticalAccuracy`, plus address
     fields (`streetAddress`, `locality`, `stateCode`, `country`).

This means python-findmy-service doesn't reimplement any Apple crypto —
it reuses the `pyicloud` library (PyPI, actively maintained) for
login/2FA/session persistence, and adds one small client for the `fmf`
endpoint (not shipped in pyicloud's own package — there was an unmerged
PR for it, so we write our own thin version against the same session).

## Architecture

Three services, docker-compose, local-first:

```
react-frontend  -->  spring-bff  -->  python-findmy-service
                         |
                         v
                     Postgres (app schema)
```

`python-findmy-service` is stateless (no database) — see below.

### python-findmy-service (Python)

Thin, stateless wrapper around `pyicloud` plus the `fmf` friends client.
Every call takes the Apple ID (+ password when (re)authenticating) from
spring-bff — this service holds no account records of its own.
Responsibilities:
- Apple ID login via `pyicloud.PyiCloudService` (handles the web-session
  auth); 2FA via `requires_2fa` / `send_verification_code` /
  `validate_verification_code` (or `validate_2fa_code` for HSA2 accounts).
- Cookie/session persistence: construct `PyiCloudService` with
  `cookie_directory` set to a path derived from `sha256(apple_id)` on a
  Docker volume, so repeated calls for the same account reuse the
  existing session instead of re-authenticating every time. This volume
  holds the actual credential material and must never be exposed outside
  the container.
- Friends client: read the `fmf` entry from `PyiCloudService._webservices`
  after login, POST to `{fmf_root}/fmipservice/client/fmfWeb/initClient`,
  parse the friend list into `{id, name, latitude, longitude, timestamp,
  accuracy}`.
- Internal REST API (not internet-facing, only spring-bff calls it):
  - `POST /accounts/login` — `{apple_id, password}` → start/resume login
  - `POST /accounts/{apple_id}/2fa` — `{code}` → submit 2FA code
  - `POST /accounts/{apple_id}/people` — list of people sharing location +
    latest position/last-seen (re-authenticates from the cookie volume;
    POST with an optional `{"password": ...}` body only if a fresh login
    is required — kept out of the URL/query string so it never lands in
    access logs)
- Every request must carry a shared internal secret
  (`X-Internal-Token` header, checked against the `INTERNAL_SERVICE_TOKEN`
  env var) or gets rejected with 401 before touching `icloud_client` —
  this service has no per-account auth of its own (single-user design, no
  multi-tenant model), so the token's only job is proving the caller is
  spring-bff and not anything else reachable on the Docker network or,
  if the port is ever accidentally published, the host/LAN. Fails closed:
  if the env var isn't set, every request is rejected.
- 2FA submission is rate-limited per `apple_id` (in-memory, fixed window —
  e.g. 5 failed attempts / 15 minutes → 429) since it's a 6-digit code
  (10^6 space) behind an unauthenticated-by-anyone-on-the-network endpoint
  otherwise.

### spring-bff (Java, Spring Boot)

The only service the frontend talks to. Responsibilities:
- Dashboard auth: HTTP Basic against a single fixed credential (username +
  bcrypt hash, both from env vars) via Spring Security's
  `InMemoryUserDetailsManager` — no login endpoint, no JWT, no session
  table. Simpler than a session/JWT flow for a single hardcoded user, and
  the frontend can attach the credential to every request itself rather
  than managing a token lifecycle.
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

### Postgres

Single `app` schema, owned entirely by spring-bff: dashboard user, fm
accounts (apple_id + encrypted password + status), people, location
history, alert rules, alert events.

## Data flow

1. User registers Apple ID in frontend → spring-bff stores the account
   (encrypted password) in its `app` schema → calls python-findmy-service
   `POST /accounts/login` with `{apple_id, password}`.
2. If Apple challenges with 2FA, python-findmy-service returns a
   "2fa-required" status; spring-bff relays it to the frontend, which
   prompts for the code; code is submitted to
   `POST /accounts/{apple_id}/2fa`, and spring-bff updates the account's
   status on success.
3. On success, python-findmy-service's cookie volume now holds a valid
   session for that `apple_id` — no further password needed until it
   expires.
4. spring-bff's scheduler polls `GET /accounts/{apple_id}/people` on an
   interval, upserts into `app` schema, evaluates alert rules against the
   delta. If python-findmy-service reports the session expired, spring-bff
   retries the login using its stored (encrypted) password.
5. Frontend queries spring-bff for current people state, history, and
   alerts; renders map via mapcn.

## Error handling

- 2FA pending → explicit status code/shape the frontend recognizes and
  turns into a code-entry prompt.
- Apple rate-limiting / account lockout → backoff in python-findmy-service,
  surfaced as an account-level status the frontend can display.
- Expired/invalid session (cookie no longer trusted) → python-findmy-service
  reports an account status requiring re-login; spring-bff surfaces it
  instead of silently failing polls.
- Missing/partial friend data in a single poll (friend hasn't shared
  recently) → keep last-known location, don't treat as an error.
- Missing/wrong internal token → 401, logged as a potential misconfigured
  caller (or worse, an unexpected caller) — not silently ignored.
- Too many failed 2FA attempts for an account → 429 until the lockout
  window clears.

## Deployment

- docker-compose bundles four containers (frontend, bff, python service,
  postgres) for local run on the Mac mini.
- `python-findmy-service`'s port is never published to `0.0.0.0` on the
  host — only bound to `127.0.0.1` for local dev/smoke-testing from the
  Mac mini itself, and reachable to `spring-bff` purely over the
  docker-compose internal network by service name. It has no business
  being reachable from the LAN, let alone the internet.
- Later: front a tunnel (Cloudflare Tunnel or Tailscale funnel) only at
  spring-bff + react-frontend. python-findmy-service and Postgres stay
  internal, never directly exposed.

## Testing strategy

- python-findmy-service: unit tests for the `fmf` response parser (fixture
  JSON in, structured friend list out) and for 2FA state-machine handling,
  mocking `pyicloud`'s `PyiCloudService`.
- spring-bff: unit tests for alert rule evaluation; integration tests for
  the scheduler + persistence using Testcontainers Postgres.
- react-frontend: light component tests; manual verification via running
  the app is acceptable for v1 (no heavy e2e suite).

## Implementation order

1. python-findmy-service (pyicloud auth + `fmf` friends client).
2. spring-bff (auth, orchestration, scheduler, alert engine, persistence).
3. react-frontend last, once backend/BFF APIs are stable.

## Open risks

- The `fmf` endpoint is unofficial/undocumented; Apple can change or
  remove it without notice. Treat parse failures and account lockout as
  expected failure modes, not edge cases.
- Automated logins can trip Apple's fraud/rate-limit detection — confirm
  the login + 2FA + friends fetch works end to end against the real
  Apple ID early (spike before building the rest of python-findmy-service).
