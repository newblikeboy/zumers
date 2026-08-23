-- +goose Up
ALTER TABLE business_accounts
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_business_accounts_postal_code ON business_accounts (postal_code);

-- +goose Down
DROP INDEX IF EXISTS idx_business_accounts_postal_code;

ALTER TABLE business_accounts
  DROP COLUMN IF EXISTS postal_code;
