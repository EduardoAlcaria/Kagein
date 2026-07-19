# Zone-Based Alerts (sub-project) — design

## Purpose

Replace the roadmap's original "proximity alerts" framing (B) with a
zone-based alerting system, and pull the geofencing core (E) forward as the
real foundation. All location alerts in the product are zone-based: a person
crossing into, out of, or sitting inside a geographic zone anchored to a saved
point of interest. Person-to-person proximity is explicitly NOT built here; if
it ever exists it will be expressed as zones too.

This also promotes the map's "add as alert point" stub — which today only
writes to `localStorage` (see `2026-07-08-react-frontend-redesign-design.md`
Out of Scope) — into real backend-persisted points that zones hang off of.

## Core model (agreed)

- **Point of interest (POI).** A saved place: label + latitude/longitude.
  Belongs to an `fm_account`. This is the promoted "alert point".
- **Zone.** An alert area that belongs to exactly one POI. Two shapes:
  - **Circle** — the POI is the center, plus a `radius_meters`.
  - **Polygon** — a free-drawn shape (list of vertices) around the POI.
  Each zone carries its own **trigger**, **color**, and **alarm message**.
- **Trigger (per zone).** One of `ENTER`, `LEAVE`, `INSIDE`:
  - `ENTER` — fire when a person goes from outside the zone to inside.
  - `LEAVE` — fire when a person goes from inside to outside.
  - `INSIDE` — fire on every poll while the person is inside.
- **Nesting is general and emergent, not modeled explicitly.** Any shape may
  sit inside any other shape — circle in polygon, polygon in circle, circle in
  circle — to any depth, across different POIs. Example: a large city-wide
  radius (a zone on POI "Centro") with several smaller circles and drawn
  shapes (zones on other POIs) coexisting inside it. There is **no** parent/
  child column and **no** priority ordering: containment falls out of the
  coordinates. Each zone is evaluated independently; a person inside N zones
  at once fires each of those N zones' own alarms.
- **Zones watch points, not people.** Every zone evaluates against every
  tracked person. There is no per-zone person assignment.

## Everything reduces to coordinates

Both shapes are, at evaluation time, just geometry over lat/lon:

- Circle: `haversine(person, poiCenter) <= radius_meters`.
- Polygon: standard even-odd ray-casting point-in-polygon over `vertices`.

This is the "plot on a graph" idea the user described — the selection UX
(drawing) is only a way to produce coordinates; the backend never cares
whether a shape was drawn or dialed in as a radius.

## Decomposition

Too large for one implementation plan. One spec, two layers; the plan splits
them into tasks:

1. **Layer 1 — Points + Zones backend.** Schema, geometry predicates, CRUD
   endpoints, and the polling-time evaluation service that emits alerts.
2. **Layer 2 — Reusable selection primitive (frontend).** A map component
   that lets the user place a circle (center + radius) or draw a polygon and
   returns geometry as coordinates. Reusable anywhere the product needs an
   area/radius configured, not just here.

## Layer 1 — backend

### Schema (new Flyway migration)

```sql
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
    shape VARCHAR(16) NOT NULL,            -- 'CIRCLE' | 'POLYGON'
    radius_meters INT,                     -- required when shape = CIRCLE
    vertices JSONB,                        -- required when shape = POLYGON: [[lat,lon], ...]
    trigger VARCHAR(16) NOT NULL,          -- 'ENTER' | 'LEAVE' | 'INSIDE'
    color VARCHAR(16) NOT NULL,            -- hex or token, for map + alert coloring
    alarm_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`alert_event` gains one nullable column so the UI can color an alert by its
zone:

```sql
ALTER TABLE alert_event ADD COLUMN zone_id BIGINT NULL REFERENCES zone(id);
```

Existing stale-update alerts leave `zone_id` null — no behavior change to them.

### Geometry (pure, isolated, unit-tested)

A small `Geometry` helper: `distanceMeters(latA, lonA, latB, lonB)` (haversine)
and `pointInPolygon(lat, lon, vertices)` (ray-casting). No Spring, no DB —
tested directly, including edge cases (on-boundary, concave polygon, antimeridian
left out of scope for now, note inline).

### Evaluation — `ZoneAlertService`

Runs once at the end of `PollingService.pollAllActiveAccounts()`, after all new
fixes are saved.

A zone belongs to a POI, which belongs to an `fm_account`. A zone is only
evaluated against persons of that same account (`person.fm_account_id ==
poi.fm_account_id`) — one account's zones never fire on another account's
people.

Per tracked person, using their two most recent fixes (`current`, `previous`
from `person_location`), against the zones owned by that person's account:

- Determine `insideNow` / `insidePrev` for each zone via the geometry helper.
- `ENTER` fires when `insideNow && !insidePrev`.
- `LEAVE` fires when `!insideNow && insidePrev`.
- `INSIDE` fires when `insideNow`.
- **Movement/freshness guard (carried from earlier discussion):** a person
  who is *moving* (recent trail displacement over `movement-threshold-m`)
  must have a `current` fix within `freshness-window-min`, otherwise their
  position is not trusted and the person is skipped this cycle. A stationary
  person's last fix is trusted regardless of age.

On a fire, save an `AlertEvent` with `type` = the trigger, `zone_id` = the
zone, `person_id` = the person, `message` = the zone's `alarm_message` (with
the person's name interpolated), `triggered_at` = now.

Config props with defaults:
`zone.freshness-window-min:15`, `zone.movement-threshold-m:30`,
`zone.movement-window-min:15`.

Note on `INSIDE`: fires every poll while inside (matches the "every poll while
close" firing decision made for the old proximity model). `ENTER`/`LEAVE` are
naturally deduped by the transition check.

### REST

- `POST /api/points` `{label, latitude, longitude}` → created POI.
- `GET /api/points` → list for the account.
- `DELETE /api/points/{id}` (cascades its zones).
- `POST /api/zones` `{poiId, shape, radiusMeters?, vertices?, trigger, color, alarmMessage}`
  — validates: shape-specific fields present, radius in a sane range, polygon
  has ≥3 vertices, trigger/shape from the allowed sets.
- `GET /api/zones` → list (joined with POI center for rendering).
- `DELETE /api/zones/{id}`.

## Layer 2 — reusable selection primitive (frontend)

A `ZoneEditor` component over the existing maplibre map:

- **Circle mode:** click to place center (or use an existing POI), drag/enter
  a radius. Emits `{ shape: 'CIRCLE', center: [lat, lon], radiusMeters }`.
- **Polygon mode:** click to drop vertices, close the ring. Emits
  `{ shape: 'POLYGON', vertices: [[lat, lon], ...] }`.
- Returns geometry via a callback; it does not itself persist anything. That
  keeps it reusable for any "configure an area/radius" need.

Consumers:

- The map's existing "add as alert point" flow: search → save POI (now a real
  `POST /api/points`) → optionally attach a zone via `ZoneEditor`.
- A zones/points management surface in Settings: list POIs and their zones,
  create/delete, pick trigger + color + alarm message per zone.
- Dashboard map renders all zones color-coded (circles and polygons) as
  overlays.

Alerts flow through the existing `useAlerts`/`AlertBanner`/`AlertsPage`
plumbing unchanged; the added `zone_id`/`color` just lets those surfaces tint
a zone alert.

## Testing (TDD throughout)

- **Geometry:** haversine distances, point-in-polygon in/out/boundary, concave
  polygon.
- **`ZoneAlertService`:** ENTER on transition in, LEAVE on transition out,
  INSIDE every poll; moving-with-stale-fix skipped; stationary old fix trusted;
  a person inside two nested zones fires both.
- **Controllers:** validation for shape/field/trigger/radius/vertices.
- **Frontend:** `ZoneEditor` emits correct geometry for circle and polygon;
  points/zones hooks and management form; zone overlays render.

## Out of scope (this sub-project)

- Person-to-person proximity (may return later, as zones).
- Priority ordering / a drag queue (explicitly dropped — nesting is emergent).
- Editing an existing zone's shape in place (create + delete only for v1;
  re-draw = delete and recreate). Revisit if it hurts in use.
- Antimeridian-crossing polygons.
```
