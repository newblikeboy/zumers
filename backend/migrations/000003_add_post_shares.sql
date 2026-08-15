-- +goose Up
ALTER TABLE posts
ADD COLUMN shared_post_id BIGINT REFERENCES posts (id) ON DELETE SET NULL;

CREATE INDEX idx_posts_shared_post_id ON posts (shared_post_id);

-- +goose Down
DROP INDEX IF EXISTS idx_posts_shared_post_id;

ALTER TABLE posts
DROP COLUMN IF EXISTS shared_post_id;
