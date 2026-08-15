-- +goose Up
CREATE TABLE business_accounts (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  business_category VARCHAR(80) NOT NULL,
  location VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(40),
  description TEXT,
  offerings TEXT,
  opening_hours VARCHAR(160),
  onboarding_status VARCHAR(30) NOT NULL DEFAULT 'draft',
  account_status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_onboarding_status CHECK (onboarding_status IN ('draft', 'submitted', 'approved')),
  CONSTRAINT chk_business_account_status CHECK (account_status IN ('active', 'disabled'))
);

CREATE INDEX idx_business_accounts_category ON business_accounts (business_category);
CREATE INDEX idx_business_accounts_location ON business_accounts (location);
CREATE INDEX idx_business_accounts_status ON business_accounts (account_status, onboarding_status);

-- +goose Down
DROP TABLE IF EXISTS business_accounts;
