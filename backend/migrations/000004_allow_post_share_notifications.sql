-- +goose Up
ALTER TABLE notifications
DROP CONSTRAINT chk_notifications_type;

ALTER TABLE notifications
ADD CONSTRAINT chk_notifications_type
CHECK (notification_type IN ('friend_request', 'friend_accept', 'message', 'post_reaction', 'post_comment', 'post_share'));

-- +goose Down
ALTER TABLE notifications
DROP CONSTRAINT chk_notifications_type;

ALTER TABLE notifications
ADD CONSTRAINT chk_notifications_type
CHECK (notification_type IN ('friend_request', 'friend_accept', 'message', 'post_reaction', 'post_comment'));
