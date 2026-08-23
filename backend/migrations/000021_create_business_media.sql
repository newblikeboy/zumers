-- +goose Up
CREATE TABLE business_media (
  id BIGSERIAL PRIMARY KEY,
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL UNIQUE,
  secure_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  alt_text VARCHAR(255),
  display_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_media_type CHECK (media_type IN ('image', 'video')),
  CONSTRAINT chk_business_media_purpose CHECK (purpose IN ('cover', 'gallery', 'food', 'activity', 'menu', 'video')),
  CONSTRAINT chk_business_media_status CHECK (status IN ('active', 'hidden')),
  CONSTRAINT chk_business_media_width CHECK (width IS NULL OR width >= 0),
  CONSTRAINT chk_business_media_height CHECK (height IS NULL OR height >= 0),
  CONSTRAINT chk_business_media_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT chk_business_media_display_order CHECK (display_order >= 0)
);

CREATE TABLE venue_media (
  id BIGSERIAL PRIMARY KEY,
  venue_id BIGINT NOT NULL REFERENCES business_venues(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL UNIQUE,
  secure_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  alt_text VARCHAR(255),
  display_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_venue_media_type CHECK (media_type IN ('image', 'video')),
  CONSTRAINT chk_venue_media_purpose CHECK (purpose IN ('cover', 'gallery', 'food', 'activity', 'menu', 'video')),
  CONSTRAINT chk_venue_media_status CHECK (status IN ('active', 'hidden')),
  CONSTRAINT chk_venue_media_width CHECK (width IS NULL OR width >= 0),
  CONSTRAINT chk_venue_media_height CHECK (height IS NULL OR height >= 0),
  CONSTRAINT chk_venue_media_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT chk_venue_media_display_order CHECK (display_order >= 0)
);

CREATE TABLE experience_media (
  id BIGSERIAL PRIMARY KEY,
  experience_id BIGINT NOT NULL REFERENCES venue_experiences(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL,
  purpose VARCHAR(40) NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL UNIQUE,
  secure_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  alt_text VARCHAR(255),
  display_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_experience_media_type CHECK (media_type IN ('image', 'video')),
  CONSTRAINT chk_experience_media_purpose CHECK (purpose IN ('cover', 'gallery', 'activity', 'video')),
  CONSTRAINT chk_experience_media_status CHECK (status IN ('active', 'hidden')),
  CONSTRAINT chk_experience_media_width CHECK (width IS NULL OR width >= 0),
  CONSTRAINT chk_experience_media_height CHECK (height IS NULL OR height >= 0),
  CONSTRAINT chk_experience_media_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT chk_experience_media_display_order CHECK (display_order >= 0)
);

CREATE INDEX idx_business_media_business_id ON business_media (business_id, purpose, display_order);
CREATE INDEX idx_venue_media_venue_id ON venue_media (venue_id, purpose, display_order);
CREATE INDEX idx_experience_media_experience_id ON experience_media (experience_id, purpose, display_order);

-- +goose Down
DROP TABLE IF EXISTS experience_media;
DROP TABLE IF EXISTS venue_media;
DROP TABLE IF EXISTS business_media;
