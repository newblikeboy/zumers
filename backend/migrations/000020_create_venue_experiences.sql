-- +goose Up
CREATE TABLE venue_experiences (
  id BIGSERIAL PRIMARY KEY,
  venue_id BIGINT NOT NULL REFERENCES business_venues(id) ON DELETE CASCADE,
  experience_name VARCHAR(160) NOT NULL,
  description TEXT,
  category VARCHAR(120),
  tags TEXT,
  starting_price NUMERIC(10, 2),
  average_price_per_person NUMERIC(10, 2),
  typical_duration_minutes INT,
  min_group_size INT,
  ideal_group_size INT,
  max_group_size INT,
  indoor_outdoor VARCHAR(20),
  booking_required BOOLEAN NOT NULL DEFAULT false,
  walk_in_available BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_venue_experiences_status CHECK (status IN ('draft', 'active', 'inactive')),
  CONSTRAINT chk_venue_experiences_indoor_outdoor CHECK (indoor_outdoor IS NULL OR indoor_outdoor IN ('indoor', 'outdoor', 'both')),
  CONSTRAINT chk_venue_experiences_starting_price CHECK (starting_price IS NULL OR starting_price >= 0),
  CONSTRAINT chk_venue_experiences_average_price CHECK (average_price_per_person IS NULL OR average_price_per_person >= 0),
  CONSTRAINT chk_venue_experiences_duration CHECK (typical_duration_minutes IS NULL OR typical_duration_minutes > 0),
  CONSTRAINT chk_venue_experiences_group_sizes CHECK (
    (min_group_size IS NULL OR min_group_size > 0)
    AND (ideal_group_size IS NULL OR ideal_group_size > 0)
    AND (max_group_size IS NULL OR max_group_size > 0)
    AND (min_group_size IS NULL OR max_group_size IS NULL OR min_group_size <= max_group_size)
  )
);

CREATE INDEX idx_venue_experiences_venue_status
  ON venue_experiences (venue_id, status, display_order);
CREATE INDEX idx_venue_experiences_category
  ON venue_experiences (category);
CREATE INDEX idx_venue_experiences_price
  ON venue_experiences (average_price_per_person);
CREATE INDEX idx_venue_experiences_duration
  ON venue_experiences (typical_duration_minutes);

-- +goose Down
DROP TABLE IF EXISTS venue_experiences;
