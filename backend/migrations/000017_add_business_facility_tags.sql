-- +goose Up
ALTER TABLE business_accounts
  ADD COLUMN IF NOT EXISTS facility_tags TEXT;

-- +goose Down
ALTER TABLE business_accounts
  DROP COLUMN IF EXISTS facility_tags;
