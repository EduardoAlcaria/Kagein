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
    shape VARCHAR(16) NOT NULL,
    radius_meters INT,
    vertices JSONB,
    trigger VARCHAR(16) NOT NULL,
    color VARCHAR(16) NOT NULL,
    alarm_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_of_interest_account ON point_of_interest (fm_account_id);
CREATE INDEX idx_zone_poi ON zone (poi_id);

ALTER TABLE alert_event ADD COLUMN zone_id BIGINT NULL REFERENCES zone(id);
