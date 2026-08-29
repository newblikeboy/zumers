-- +goose Up
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON profiles USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_business_accounts_name_lower
  ON business_accounts (lower(business_name));

CREATE INDEX IF NOT EXISTS idx_business_accounts_city_area_lower
  ON business_accounts (lower(city), lower(area))
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_accounts_location_lower_trgm
  ON business_accounts USING gin ((lower(location)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_business_accounts_active_updated
  ON business_accounts (updated_at DESC, id)
  WHERE account_status = 'active';

CREATE INDEX IF NOT EXISTS idx_posts_active_created
  ON posts (created_at DESC, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_shared_active
  ON posts (shared_post_id, id)
  WHERE deleted_at IS NULL AND shared_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_post_active_created
  ON comments (post_id, created_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_active_created_desc
  ON messages (conversation_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_active
  ON conversation_members (user_id, conversation_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_active
  ON conversation_members (conversation_id, joined_at, id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_message_receipts_conversation_user_unread
  ON message_receipts (conversation_id, user_id, message_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_media_active_cover
  ON business_media (business_id, purpose, display_order, id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_venue_media_active_cover
  ON venue_media (venue_id, purpose, display_order, id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_experience_media_active_cover
  ON experience_media (experience_id, purpose, display_order, id)
  WHERE status = 'active';

-- +goose Down
DROP INDEX IF EXISTS idx_experience_media_active_cover;
DROP INDEX IF EXISTS idx_venue_media_active_cover;
DROP INDEX IF EXISTS idx_business_media_active_cover;
DROP INDEX IF EXISTS idx_message_receipts_conversation_user_unread;
DROP INDEX IF EXISTS idx_conversation_members_conversation_active;
DROP INDEX IF EXISTS idx_conversation_members_user_active;
DROP INDEX IF EXISTS idx_messages_conversation_active_created_desc;
DROP INDEX IF EXISTS idx_comments_post_active_created;
DROP INDEX IF EXISTS idx_posts_shared_active;
DROP INDEX IF EXISTS idx_posts_active_created;
DROP INDEX IF EXISTS idx_business_accounts_active_updated;
DROP INDEX IF EXISTS idx_business_accounts_location_lower_trgm;
DROP INDEX IF EXISTS idx_business_accounts_city_area_lower;
DROP INDEX IF EXISTS idx_business_accounts_name_lower;
DROP INDEX IF EXISTS idx_profiles_display_name_trgm;
DROP INDEX IF EXISTS idx_profiles_username_trgm;
