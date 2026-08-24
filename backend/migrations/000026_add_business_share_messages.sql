-- +goose Up
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS chk_messages_type;

ALTER TABLE messages
  ADD CONSTRAINT chk_messages_type CHECK (message_type IN ('text', 'image', 'video', 'business_share'));

CREATE TABLE business_share_votes (
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT chk_business_share_votes_vote CHECK (vote IN ('like', 'dislike'))
);

CREATE INDEX idx_business_share_votes_user_updated
  ON business_share_votes (user_id, updated_at DESC);

-- +goose Down
DROP TABLE IF EXISTS business_share_votes;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS chk_messages_type;

ALTER TABLE messages
  ADD CONSTRAINT chk_messages_type CHECK (message_type IN ('text', 'image', 'video'));
