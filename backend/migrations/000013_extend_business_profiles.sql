-- +goose Up
ALTER TABLE business_accounts
  ADD COLUMN IF NOT EXISTS business_subcategory VARCHAR(120),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(120),
  ADD COLUMN IF NOT EXISTS area VARCHAR(120),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS price_range VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mood_tags TEXT,
  ADD COLUMN IF NOT EXISTS service_tags TEXT,
  ADD COLUMN IF NOT EXISTS best_for TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(40);

ALTER TABLE business_accounts
  ADD CONSTRAINT chk_business_price_range
  CHECK (price_range IS NULL OR price_range IN ('budget', 'moderate', 'premium', 'luxury'));

CREATE INDEX IF NOT EXISTS idx_business_accounts_city_area ON business_accounts (city, area);
CREATE INDEX IF NOT EXISTS idx_business_accounts_subcategory ON business_accounts (business_subcategory);
CREATE INDEX IF NOT EXISTS idx_business_accounts_price_range ON business_accounts (price_range);

-- +goose Down
DROP INDEX IF EXISTS idx_business_accounts_price_range;
DROP INDEX IF EXISTS idx_business_accounts_subcategory;
DROP INDEX IF EXISTS idx_business_accounts_city_area;

ALTER TABLE business_accounts
  DROP CONSTRAINT IF EXISTS chk_business_price_range,
  DROP COLUMN IF EXISTS whatsapp_number,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS best_for,
  DROP COLUMN IF EXISTS service_tags,
  DROP COLUMN IF EXISTS mood_tags,
  DROP COLUMN IF EXISTS price_range,
  DROP COLUMN IF EXISTS service_radius_km,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS area,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS business_subcategory;
