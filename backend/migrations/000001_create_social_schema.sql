-- +goose Up
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  account_status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_users_account_status CHECK (account_status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX idx_users_account_status ON users (account_status);

CREATE TABLE profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  display_name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  bio TEXT,
  location VARCHAR(120),
  avatar_url TEXT,
  avatar_public_id VARCHAR(255),
  cover_url TEXT,
  cover_public_id VARCHAR(255),
  profile_visibility VARCHAR(30) NOT NULL DEFAULT 'friends',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_profiles_user_id UNIQUE (user_id),
  CONSTRAINT chk_profiles_visibility CHECK (profile_visibility IN ('public', 'friends', 'private'))
);

CREATE INDEX idx_profiles_display_name ON profiles (display_name);

CREATE TABLE friend_requests (
  id BIGSERIAL PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_friend_requests_pair_status UNIQUE (sender_id, receiver_id, status),
  CONSTRAINT chk_friend_requests_status CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  CONSTRAINT chk_friend_requests_not_self CHECK (sender_id <> receiver_id)
);

CREATE INDEX idx_friend_requests_receiver_status ON friend_requests (receiver_id, status);
CREATE INDEX idx_friend_requests_sender_status ON friend_requests (sender_id, status);

CREATE TABLE friendships (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_friendships_pair UNIQUE (user_id, friend_id),
  CONSTRAINT chk_friendships_order CHECK (user_id < friend_id)
);

CREATE INDEX idx_friendships_friend_id ON friendships (friend_id);

CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  author_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content TEXT,
  visibility VARCHAR(30) NOT NULL DEFAULT 'friends',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_posts_visibility CHECK (visibility IN ('public', 'friends', 'private'))
);

CREATE INDEX idx_posts_author_created_at ON posts (author_id, created_at);
CREATE INDEX idx_posts_visibility_created_at ON posts (visibility, created_at);
CREATE INDEX idx_posts_deleted_at ON posts (deleted_at);

CREATE TABLE post_media (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL UNIQUE,
  secure_url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_post_media_type CHECK (media_type IN ('image', 'video')),
  CONSTRAINT chk_post_media_width CHECK (width IS NULL OR width >= 0),
  CONSTRAINT chk_post_media_height CHECK (height IS NULL OR height >= 0),
  CONSTRAINT chk_post_media_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  CONSTRAINT chk_post_media_display_order CHECK (display_order >= 0)
);

CREATE INDEX idx_post_media_post_id ON post_media (post_id);

CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_post_created_at ON comments (post_id, created_at);
CREATE INDEX idx_comments_author_created_at ON comments (author_id, created_at);

CREATE TABLE post_reactions (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reaction_type VARCHAR(30) NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_post_reactions_post_user UNIQUE (post_id, user_id),
  CONSTRAINT chk_post_reactions_type CHECK (reaction_type IN ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'))
);

CREATE INDEX idx_post_reactions_user_id ON post_reactions (user_id);

CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  user_one_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_two_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_conversations_pair UNIQUE (user_one_id, user_two_id),
  CONSTRAINT chk_conversations_order CHECK (user_one_id < user_two_id)
);

CREATE INDEX idx_conversations_user_two_id ON conversations (user_two_id);
CREATE INDEX idx_conversations_updated_at ON conversations (updated_at);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_public_id VARCHAR(255),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_messages_type CHECK (message_type IN ('text', 'image', 'video'))
);

CREATE INDEX idx_messages_conversation_created_at ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_read_at ON messages (read_at);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES users (id) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id BIGINT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_notifications_type CHECK (notification_type IN ('friend_request', 'friend_accept', 'message', 'post_reaction', 'post_comment', 'post_share'))
);

CREATE INDEX idx_notifications_user_created_at ON notifications (user_id, created_at);
CREATE INDEX idx_notifications_user_read_at ON notifications (user_id, read_at);
CREATE INDEX idx_notifications_actor_id ON notifications (actor_id);

-- +goose Down
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS post_reactions;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_media;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS friend_requests;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;
