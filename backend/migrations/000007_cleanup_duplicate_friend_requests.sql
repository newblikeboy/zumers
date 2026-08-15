-- +goose Up
UPDATE friend_requests fr
SET status = 'cancelled',
    updated_at = CURRENT_TIMESTAMP
WHERE fr.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM friendships f
    WHERE f.user_id = LEAST(fr.sender_id, fr.receiver_id)
      AND f.friend_id = GREATEST(fr.sender_id, fr.receiver_id)
  );

-- +goose Down
-- Data cleanup migration; no safe automatic rollback.
