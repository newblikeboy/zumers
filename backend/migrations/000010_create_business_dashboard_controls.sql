-- +goose Up
CREATE TABLE business_dashboard_controls (
  business_id BIGINT PRIMARY KEY REFERENCES business_accounts(id) ON DELETE CASCADE,
  today_update TEXT,
  today_highlight VARCHAR(160),
  offer_title VARCHAR(160),
  offer_details TEXT,
  offer_valid_until DATE,
  offer_status VARCHAR(30) NOT NULL DEFAULT 'draft',
  offer_clicks BIGINT NOT NULL DEFAULT 0,
  profile_visits BIGINT NOT NULL DEFAULT 0,
  booking_clicks BIGINT NOT NULL DEFAULT 0,
  direction_clicks BIGINT NOT NULL DEFAULT 0,
  saves BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_offer_status CHECK (offer_status IN ('draft', 'active', 'paused'))
);

CREATE TABLE business_booking_requests (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  requester_name VARCHAR(160) NOT NULL,
  requester_contact VARCHAR(160),
  booking_note TEXT,
  booking_time TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_booking_status CHECK (status IN ('pending', 'confirmed', 'declined', 'completed'))
);

CREATE INDEX idx_business_booking_requests_business_status
  ON business_booking_requests (business_id, status, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS business_booking_requests;
DROP TABLE IF EXISTS business_dashboard_controls;
