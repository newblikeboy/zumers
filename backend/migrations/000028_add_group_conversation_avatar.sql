-- +goose Up
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_public_id VARCHAR(255);

-- +goose Down
ALTER TABLE conversations
  DROP COLUMN IF EXISTS avatar_public_id,
  DROP COLUMN IF EXISTS avatar_url;
