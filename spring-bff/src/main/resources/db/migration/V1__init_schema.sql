-- spring-bff/src/main/resources/db/migration/V1__init_schema.sql
CREATE TABLE fm_account (
    id BIGSERIAL PRIMARY KEY,
    apple_id VARCHAR(255) NOT NULL UNIQUE,
    encrypted_password TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE person (
    id BIGSERIAL PRIMARY KEY,
    fm_account_id BIGINT NOT NULL REFERENCES fm_account(id),
    external_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    UNIQUE (fm_account_id, external_id)
);

CREATE TABLE person_location (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES person(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    captured_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_person_location_person_captured
    ON person_location (person_id, captured_at DESC);

CREATE TABLE alert_event (
    id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL REFERENCES person(id),
    type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
