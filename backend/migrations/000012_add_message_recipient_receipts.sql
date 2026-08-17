-- +goose Up
CREATE TABLE IF NOT EXISTS message_receipts (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_message_receipts_message_user UNIQUE (message_id, user_id)
);

INSERT INTO message_receipts (message_id, conversation_id, user_id, delivered_at, read_at, created_at, updated_at)
SELECT m.id, m.conversation_id, cm.user_id, m.delivered_at, m.read_at, m.created_at, CURRENT_TIMESTAMP
FROM messages m
JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
WHERE cm.user_id <> m.sender_id
  AND cm.left_at IS NULL
ON CONFLICT (message_id, user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_message_receipts_conversation_user
  ON message_receipts (conversation_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id
  ON message_receipts (message_id);

-- +goose Down
DROP INDEX IF EXISTS idx_message_receipts_message_id;
DROP INDEX IF EXISTS idx_message_receipts_conversation_user;
DROP TABLE IF EXISTS message_receipts;
