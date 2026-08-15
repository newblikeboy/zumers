-- +goose Up
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_delivered_at ON messages (delivered_at);

-- +goose Down
DROP INDEX IF EXISTS idx_messages_delivered_at;

ALTER TABLE messages
  DROP COLUMN IF EXISTS delivered_at;
