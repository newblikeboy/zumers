-- +goose Up
CREATE TABLE business_opening_hours (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL,
  interval_order SMALLINT NOT NULL DEFAULT 1,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  opens_at VARCHAR(5),
  closes_at VARCHAR(5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_opening_hours_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT chk_business_opening_hours_interval_order CHECK (interval_order BETWEEN 1 AND 4),
  CONSTRAINT chk_business_opening_hours_time_state CHECK (
    (is_closed = true AND opens_at IS NULL AND closes_at IS NULL)
    OR
    (is_closed = false AND opens_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND closes_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  ),
  CONSTRAINT uq_business_opening_hours_interval UNIQUE (business_id, weekday, interval_order)
);

CREATE INDEX idx_business_opening_hours_business_weekday
  ON business_opening_hours (business_id, weekday, interval_order);

-- +goose Down
DROP TABLE IF EXISTS business_opening_hours;
