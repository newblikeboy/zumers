-- +goose Up
WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
      ORDER BY created_at DESC, id DESC
    ) AS position
  FROM friend_requests
  WHERE status = 'pending'
)
UPDATE friend_requests fr
SET status = 'cancelled',
    updated_at = CURRENT_TIMESTAMP
FROM ranked_pending rp
WHERE fr.id = rp.id
  AND rp.position > 1;

ALTER TABLE friend_requests
DROP CONSTRAINT IF EXISTS uq_friend_requests_pair_status;

CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_requests_pending_pair
ON friend_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
WHERE status = 'pending';

-- +goose Down
DROP INDEX IF EXISTS uq_friend_requests_pending_pair;

ALTER TABLE friend_requests
ADD CONSTRAINT uq_friend_requests_pair_status UNIQUE (sender_id, receiver_id, status);
