-- +goose Up
CREATE TABLE business_venues (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  venue_name VARCHAR(160) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  location VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(120),
  area VARCHAR(120),
  postal_code VARCHAR(20),
  google_place_id VARCHAR(255),
  state VARCHAR(120),
  country VARCHAR(120),
  district VARCHAR(120),
  landmark VARCHAR(160),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location_accuracy_meters NUMERIC(9, 2),
  location_verified BOOLEAN NOT NULL DEFAULT false,
  service_radius_km NUMERIC(6, 2),
  opening_hours TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_venues_status CHECK (status IN ('active', 'inactive')),
  CONSTRAINT chk_business_venues_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_business_venues_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_business_venues_location_accuracy CHECK (location_accuracy_meters IS NULL OR location_accuracy_meters >= 0),
  CONSTRAINT chk_business_venues_service_radius CHECK (service_radius_km IS NULL OR service_radius_km >= 0)
);

CREATE UNIQUE INDEX uq_business_venues_primary
  ON business_venues (business_id)
  WHERE is_primary = true;
CREATE INDEX idx_business_venues_business_status
  ON business_venues (business_id, status);
CREATE INDEX idx_business_venues_city_area
  ON business_venues (city, area);
CREATE INDEX idx_business_venues_google_place_id
  ON business_venues (google_place_id);

INSERT INTO business_venues (
  business_id,
  venue_name,
  is_primary,
  location,
  address,
  city,
  area,
  postal_code,
  google_place_id,
  state,
  country,
  district,
  landmark,
  latitude,
  longitude,
  location_accuracy_meters,
  location_verified,
  service_radius_km,
  opening_hours,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  business_name,
  true,
  location,
  address,
  city,
  area,
  postal_code,
  google_place_id,
  state,
  country,
  district,
  landmark,
  latitude,
  longitude,
  location_accuracy_meters,
  location_verified,
  service_radius_km,
  opening_hours,
  CASE WHEN account_status = 'active' THEN 'active' ELSE 'inactive' END,
  created_at,
  updated_at
FROM business_accounts
ON CONFLICT DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS business_venues;
