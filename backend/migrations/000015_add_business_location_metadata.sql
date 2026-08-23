-- +goose Up
ALTER TABLE business_accounts
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS state VARCHAR(120),
  ADD COLUMN IF NOT EXISTS country VARCHAR(120),
  ADD COLUMN IF NOT EXISTS district VARCHAR(120),
  ADD COLUMN IF NOT EXISTS landmark VARCHAR(160),
  ADD COLUMN IF NOT EXISTS location_accuracy_meters NUMERIC(9, 2),
  ADD COLUMN IF NOT EXISTS location_verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_business_accounts_google_place_id ON business_accounts (google_place_id);
CREATE INDEX IF NOT EXISTS idx_business_accounts_state_city ON business_accounts (state, city);
CREATE INDEX IF NOT EXISTS idx_business_accounts_location_verified ON business_accounts (location_verified);

-- +goose Down
DROP INDEX IF EXISTS idx_business_accounts_location_verified;
DROP INDEX IF EXISTS idx_business_accounts_state_city;
DROP INDEX IF EXISTS idx_business_accounts_google_place_id;

ALTER TABLE business_accounts
  DROP COLUMN IF EXISTS location_verified,
  DROP COLUMN IF EXISTS location_accuracy_meters,
  DROP COLUMN IF EXISTS landmark,
  DROP COLUMN IF EXISTS district,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS google_place_id;
