-- +goose Up
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(20) NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS title VARCHAR(120),
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE conversations
  ALTER COLUMN user_two_id DROP NOT NULL;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS chk_conversations_order;

ALTER TABLE conversations
  ADD CONSTRAINT chk_conversations_type CHECK (conversation_type IN ('direct', 'group')),
  ADD CONSTRAINT chk_conversations_shape CHECK (
    (conversation_type = 'direct' AND user_one_id IS NOT NULL AND user_two_id IS NOT NULL AND user_one_id < user_two_id)
    OR
    (conversation_type = 'group' AND user_one_id IS NOT NULL AND user_two_id IS NULL AND title IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS conversation_members (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMPTZ,
  CONSTRAINT chk_conversation_members_role CHECK (role IN ('owner', 'member')),
  CONSTRAINT uq_conversation_members_active UNIQUE (conversation_id, user_id)
);

INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
SELECT id, user_one_id, 'member', created_at
FROM conversations
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
SELECT id, user_two_id, 'member', created_at
FROM conversations
WHERE user_two_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type_updated_at ON conversations (conversation_type, updated_at);

-- +goose Down
DROP INDEX IF EXISTS idx_conversations_type_updated_at;
DROP INDEX IF EXISTS idx_conversation_members_conversation_id;
DROP INDEX IF EXISTS idx_conversation_members_user_id;
DROP TABLE IF EXISTS conversation_members;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS chk_conversations_shape,
  DROP CONSTRAINT IF EXISTS chk_conversations_type;

ALTER TABLE conversations
  ADD CONSTRAINT chk_conversations_order CHECK (user_one_id < user_two_id);

ALTER TABLE conversations
  ALTER COLUMN user_two_id SET NOT NULL,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS conversation_type;
