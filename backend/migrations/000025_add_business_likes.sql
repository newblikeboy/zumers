-- +goose Up
CREATE TABLE business_likes (
  business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_id, user_id)
);

CREATE INDEX idx_business_likes_user_created
  ON business_likes (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS business_likes;
