-- +goose Up
CREATE TABLE business_offers (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  venue_id BIGINT REFERENCES business_venues(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  original_price NUMERIC(12, 2),
  offer_price NUMERIC(12, 2),
  discount_percent NUMERIC(5, 2),
  discount_amount NUMERIC(12, 2),
  starts_on DATE,
  ends_on DATE,
  starts_at TIME,
  ends_at TIME,
  applicable_days VARCHAR(80),
  terms TEXT,
  target_audience VARCHAR(160),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  click_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_offer_status CHECK (status IN ('draft', 'active', 'paused', 'expired')),
  CONSTRAINT chk_business_offer_prices CHECK (
    (original_price IS NULL OR original_price >= 0) AND
    (offer_price IS NULL OR offer_price >= 0) AND
    (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)) AND
    (discount_amount IS NULL OR discount_amount >= 0)
  ),
  CONSTRAINT chk_business_offer_dates CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE business_events (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  venue_id BIGINT REFERENCES business_venues(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  event_type VARCHAR(80),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  price_min NUMERIC(12, 2),
  price_max NUMERIC(12, 2),
  booking_required BOOLEAN NOT NULL DEFAULT FALSE,
  target_audience VARCHAR(160),
  terms TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_event_status CHECK (status IN ('draft', 'scheduled', 'active', 'cancelled', 'completed')),
  CONSTRAINT chk_business_event_prices CHECK (
    (price_min IS NULL OR price_min >= 0) AND
    (price_max IS NULL OR price_max >= 0) AND
    (price_min IS NULL OR price_max IS NULL OR price_max >= price_min)
  ),
  CONSTRAINT chk_business_event_times CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);

INSERT INTO business_offers (
  business_id,
  title,
  description,
  ends_on,
  status,
  click_count,
  created_at,
  updated_at
)
SELECT
  business_id,
  offer_title,
  offer_details,
  offer_valid_until,
  offer_status,
  offer_clicks,
  updated_at,
  updated_at
FROM business_dashboard_controls
WHERE offer_title IS NOT NULL
  AND btrim(offer_title) <> '';

CREATE INDEX idx_business_offers_business_status
  ON business_offers (business_id, status, ends_on, created_at DESC);

CREATE INDEX idx_business_offers_venue_status
  ON business_offers (venue_id, status, ends_on)
  WHERE venue_id IS NOT NULL;

CREATE INDEX idx_business_events_business_status
  ON business_events (business_id, status, starts_at);

CREATE INDEX idx_business_events_venue_status
  ON business_events (venue_id, status, starts_at)
  WHERE venue_id IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS business_events;
DROP TABLE IF EXISTS business_offers;
