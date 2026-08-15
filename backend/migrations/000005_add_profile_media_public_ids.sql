-- +goose Up
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_public_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cover_public_id VARCHAR(255);

-- +goose Down
ALTER TABLE profiles
  DROP COLUMN IF EXISTS cover_public_id,
  DROP COLUMN IF EXISTS avatar_public_id;
