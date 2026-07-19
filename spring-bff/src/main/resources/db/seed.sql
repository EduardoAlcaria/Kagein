-- Dev-only seed data for manual UI testing. NOT run by Flyway (lives outside
-- db/migration). Load with:
--   docker compose exec -T postgres psql -U findmy -d findmy < spring-bff/src/main/resources/db/seed.sql
-- Idempotent: wipes the tracked tables first, then reinserts a fixed set.
-- Account status is PENDING_2FA so the ACTIVE-only poller never touches these
-- rows (no real Apple session behind them).

BEGIN;

TRUNCATE alert_event, person_location, person, fm_account RESTART IDENTITY CASCADE;

INSERT INTO fm_account (apple_id, encrypted_password, status)
VALUES ('demo@icloud.com', 'seed-not-a-real-credential', 'PENDING_2FA');

-- People (fm_account_id = 1 from RESTART IDENTITY)
INSERT INTO person (fm_account_id, external_id, name) VALUES
  (1, 'ext-ana',   'Ana Ferreira'),
  (1, 'ext-bruno', 'Bruno Costa'),
  (1, 'ext-carla', 'Carla Mendes');

-- Locations. Ana + Carla are within the 5-min LIVE window; Bruno is STALE.
-- Ana also gets a short trail so the location-history panel has rows.
INSERT INTO person_location (person_id, latitude, longitude, captured_at) VALUES
  -- Ana (id 1) trail around Av. Paulista, most recent first
  (1, -23.5613, -46.6560, now() - interval '1 minute'),
  (1, -23.5620, -46.6548, now() - interval '9 minutes'),
  (1, -23.5635, -46.6531, now() - interval '18 minutes'),
  (1, -23.5658, -46.6502, now() - interval '32 minutes'),
  (1, -23.5679, -46.6488, now() - interval '55 minutes'),
  -- Bruno (id 2) — stale, 40 min old
  (2, -23.5505, -46.6333, now() - interval '40 minutes'),
  (2, -23.5498, -46.6350, now() - interval '70 minutes'),
  -- Carla (id 3) — live, 2 min old
  (3, -23.5700, -46.6420, now() - interval '2 minutes'),
  (3, -23.5712, -46.6405, now() - interval '25 minutes');

-- A couple of alert events (most recent first is handled by the query).
INSERT INTO alert_event (person_id, type, message, triggered_at) VALUES
  (2, 'STALE_UPDATE', 'Bruno Costa has not reported a location in over 30 minutes.', now() - interval '12 minutes'),
  (1, 'STALE_UPDATE', 'Ana Ferreira went briefly offline earlier today.', now() - interval '3 hours');

COMMIT;
