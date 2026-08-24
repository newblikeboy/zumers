-- +goose Up
ALTER TABLE business_accounts
  ADD COLUMN IF NOT EXISTS verification_level VARCHAR(40) NOT NULL DEFAULT 'unverified';

ALTER TABLE business_venues
  ADD COLUMN IF NOT EXISTS verification_level VARCHAR(40) NOT NULL DEFAULT 'unverified';

UPDATE business_accounts
SET verification_level = CASE
  WHEN location_verified THEN 'location_verified'
  ELSE 'unverified'
END
WHERE verification_level = 'unverified';

UPDATE business_venues
SET verification_level = CASE
  WHEN location_verified THEN 'location_verified'
  ELSE 'unverified'
END
WHERE verification_level = 'unverified';

ALTER TABLE business_accounts
  ADD CONSTRAINT chk_business_accounts_verification_level
  CHECK (verification_level IN ('unverified', 'phone_verified', 'location_verified', 'ownership_verified', 'zumers_verified'));

ALTER TABLE business_venues
  ADD CONSTRAINT chk_business_venues_verification_level
  CHECK (verification_level IN ('unverified', 'phone_verified', 'location_verified', 'ownership_verified', 'zumers_verified'));

CREATE TABLE business_claim_requests (
  id BIGSERIAL PRIMARY KEY,
  existing_business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  claimant_business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  claimant_name VARCHAR(160),
  claimant_phone VARCHAR(40),
  claimant_note TEXT,
  evidence_url TEXT,
  match_source VARCHAR(40) NOT NULL DEFAULT 'manual',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_claim_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT chk_business_claim_match_source CHECK (match_source IN ('google_place_id', 'name_location', 'manual')),
  CONSTRAINT chk_business_claim_not_self CHECK (existing_business_id <> claimant_business_id)
);

CREATE UNIQUE INDEX uq_business_claim_requests_pending_pair
  ON business_claim_requests (existing_business_id, claimant_business_id)
  WHERE status = 'pending';

CREATE INDEX idx_business_claim_requests_existing_status
  ON business_claim_requests (existing_business_id, status, created_at DESC);

CREATE INDEX idx_business_claim_requests_claimant_status
  ON business_claim_requests (claimant_business_id, status, created_at DESC);

CREATE INDEX idx_business_accounts_verification_level
  ON business_accounts (verification_level);

CREATE INDEX idx_business_venues_verification_level
  ON business_venues (verification_level);

-- +goose Down
DROP INDEX IF EXISTS idx_business_venues_verification_level;
DROP INDEX IF EXISTS idx_business_accounts_verification_level;
DROP INDEX IF EXISTS idx_business_claim_requests_claimant_status;
DROP INDEX IF EXISTS idx_business_claim_requests_existing_status;
DROP INDEX IF EXISTS uq_business_claim_requests_pending_pair;
DROP TABLE IF EXISTS business_claim_requests;

ALTER TABLE business_venues
  DROP CONSTRAINT IF EXISTS chk_business_venues_verification_level;

ALTER TABLE business_accounts
  DROP CONSTRAINT IF EXISTS chk_business_accounts_verification_level;

ALTER TABLE business_venues
  DROP COLUMN IF EXISTS verification_level;

ALTER TABLE business_accounts
  DROP COLUMN IF EXISTS verification_level;
