-- Dev-only seed data for manual UI testing. NOT run by Flyway (lives outside
-- db/migration). Load with:
--   docker compose exec -T postgres psql -U findmy -d findmy < spring-bff/src/main/resources/db/seed.sql
-- Idempotent: wipes the tracked tables first, then reinserts a fixed set.
-- Account status is PENDING_2FA so the ACTIVE-only poller never touches these
-- rows (no real Apple session behind them). Because the poller never runs, the
-- zone alert_event rows below are inserted directly rather than derived.

BEGIN;

TRUNCATE alert_event, zone, point_of_interest, person_location, person, fm_account
  RESTART IDENTITY CASCADE;

INSERT INTO fm_account (apple_id, encrypted_password, status)
VALUES ('demo@icloud.com', 'seed-not-a-real-credential', 'PENDING_2FA');

-- People (fm_account_id = 1 from RESTART IDENTITY)
INSERT INTO person (fm_account_id, external_id, name) VALUES
  (1, 'ext-ava', 'Ava Turner'),
  (1, 'ext-ben', 'Ben Carter'),
  (1, 'ext-chloe', 'Chloe Hughes');

-- Locations. Ava + Chloe are within the 5-min LIVE window; Ben is STALE.
-- Ava also gets a short trail so the location-history panel has rows. Her most
-- recent fix sits at the center of the Home Base circle below.
INSERT INTO person_location (person_id, latitude, longitude, captured_at) VALUES
  -- Ava (id 1) trail around Av. Paulista, most recent first
  (1, -23.5613, -46.6560, now() - interval '1 minute'),
  (1, -23.5620, -46.6548, now() - interval '9 minutes'),
  (1, -23.5635, -46.6531, now() - interval '18 minutes'),
  (1, -23.5658, -46.6502, now() - interval '32 minutes'),
  (1, -23.5679, -46.6488, now() - interval '55 minutes'),
  -- Ben (id 2) — stale, 40 min old
  (2, -23.5505, -46.6333, now() - interval '40 minutes'),
  (2, -23.5498, -46.6350, now() - interval '70 minutes'),
  -- Chloe (id 3) — live, 2 min old, sitting inside Cafe Corner
  (3, -23.5630, -46.6520, now() - interval '2 minutes'),
  (3, -23.5712, -46.6405, now() - interval '25 minutes');

-- Points of interest (ids 1..3 from RESTART IDENTITY).
INSERT INTO point_of_interest (fm_account_id, label, latitude, longitude) VALUES
  (1, 'Home Base',        -23.5613, -46.6560),
  (1, 'Downtown District',-23.5600, -46.6540),
  (1, 'Cafe Corner',      -23.5630, -46.6520);

-- Zones (ids 1..3). Demonstrates a circle and a polygon, plus nesting: both the
-- Home Base circle and the Cafe Corner circle fall inside the Downtown polygon.
INSERT INTO zone (poi_id, shape, radius_meters, vertices, trigger, color, alarm_message) VALUES
  (1, 'CIRCLE', 300, NULL, 'INSIDE', '#ef4444', 'is inside Home Base'),
  (2, 'POLYGON', NULL,
     '[[-23.5550,-46.6600],[-23.5550,-46.6480],[-23.5680,-46.6480],[-23.5680,-46.6600]]'::jsonb,
     'ENTER', '#3b82f6', 'entered Downtown District'),
  (3, 'CIRCLE', 80, NULL, 'ENTER', '#22c55e', 'arrived at Cafe Corner');

-- Alert events (most recent first is handled by the query). Two are zone-based
-- (zone_id set, so the UI can tint them by zone color); one is a stale-update
-- alert with no zone.
INSERT INTO alert_event (person_id, zone_id, type, message, triggered_at) VALUES
  (3, 3, 'ENTER',  'Chloe Hughes: arrived at Cafe Corner', now() - interval '2 minutes'),
  (1, 1, 'INSIDE', 'Ava Turner: is inside Home Base', now() - interval '6 minutes'),
  (2, NULL, 'STALE_UPDATE', 'Ben Carter has not reported a location in over 30 minutes.', now() - interval '12 minutes');

COMMIT;
