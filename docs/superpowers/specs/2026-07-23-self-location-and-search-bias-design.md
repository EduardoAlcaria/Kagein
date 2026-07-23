# Self-Location Tracking & Proximity-Biased Search — Design

## Context

The dashboard tracks Apple Find My people and evaluates zone alerts against
their fixes. Two related capabilities are missing, both driven by the *logged-in
operator's own browser location*:

1. **Track me as a person** — persist the operator's position so they appear
   alongside tracked people and zone alerts fire on them.
2. **Google-Maps-style search** — bias the existing Nominatim address search in
   `MapPanel` toward the operator's current area so nearby results rank first.

Both read from a single browser-geolocation source. The app is single-tenant
(one dashboard login; points/zones attach to the first `fm_account`).

## Shared source: `useMyLocation` hook (frontend)

Wraps `navigator.geolocation.getCurrentPosition`. Captures a fix on mount and
then on a fixed **60-second interval** (periodic — deliberately not
`watchPosition`, to avoid continuous HTTP/battery overhead). Inactive until the
operator opts in via a toggle whose state is persisted in `localStorage`.

Exposes:

```ts
type MyLocation = { latitude: number; longitude: number } | null;
type GeoStatus = 'idle' | 'granted' | 'denied';
function useMyLocation(enabled: boolean): { coords: MyLocation; status: GeoStatus };
```

Both features consume this one hook. When `enabled` is false or permission is
denied, `coords` is `null`.

## Feature A: track me as a person

### Backend — `MeController`

`POST /api/me/location` with body `{ latitude, longitude }`:

1. Resolve the single dashboard account: first `fm_account` (mirrors
   `PointController`). If none exists, respond `409 CONFLICT` ("no account
   configured").
2. Upsert the operator's `Person`: find by `(fmAccountId, externalId='self')`,
   else create with `externalId='self'`, `name='Me'`.
3. Save a `PersonLocation` with the posted coordinates and `capturedAt=now`.
4. Call `zoneAlertService.checkAccount(account)` so the operator's zone alerts
   fire immediately, independent of the ACTIVE-only Apple poller.
5. Respond `204 No Content`; the frontend does not depend on a body.

`externalId='self'` keeps the operator distinct from Apple-sourced people
(whose ids come from the Find My service) and makes the upsert idempotent.

### Frontend

A "Share my location" toggle on the dashboard drives `useMyLocation(enabled)`.
While enabled, each periodic fix is POSTed via a `useUpdateMyLocation` mutation.
The operator then surfaces through the existing `usePeople` polling as a live
person named "Me"; existing marker and zone-alert paths handle them with no new
rendering code.

## Feature B: proximity-biased search

`MapPanel`'s Nominatim search gains a `viewbox` derived from the operator's
coords: a box of roughly ±0.15° around `(lat, lon)`, passed as
`&viewbox=lonMin,latMin,lonMax,latMax&bounded=0`. `bounded=0` makes the box a
soft preference (nearby results rank first, far ones still returned). With no
coords available the request is unchanged — global, unbiased search (current
behavior). Purely additive; the existing search tests stay valid.

## Data flow

```
browser geolocation
   -> useMyLocation (opt-in, 60s periodic)
        -> (A) useUpdateMyLocation -> POST /api/me/location
        -> (B) coords -> MapPanel search viewbox
```

## Error handling

- Geolocation denied: toggle reflects `denied`; tracking inactive; search
  silently falls back to global.
- No `fm_account`: `POST /api/me/location` returns `409`; the toggle surfaces
  "Connect an account in Settings first."
- Network failure on a periodic POST: logged/ignored; the next tick retries.

## Testing

- **Backend** `MeControllerTest` (Testcontainers + MockMvc): posts a location →
  creates the self person + location; a second post reuses the same person
  (no duplicate); `409` when no account exists.
- **Frontend**
  - `useMyLocation`: mock `navigator.geolocation`, assert a fix on mount and on
    the interval tick; denied permission yields `status='denied'`, `coords=null`.
  - `MapPanel`: search request includes `viewbox` when coords are provided and
    omits it when they are not.
  - Self-tracking toggle: enabling it issues `POST /api/me/location` with the
    captured fix.

## Scope limits

- Self-tracking requires a connected account (same single-tenant assumption as
  points/zones). Standalone self-tracking without any `fm_account` is out of
  scope.
- Distinct "Me" marker styling is out of scope; the operator renders as a normal
  live person.
- `watchPosition` continuous streaming is intentionally excluded (overhead).
