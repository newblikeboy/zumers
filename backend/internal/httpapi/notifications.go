package httpapi

import (
	"context"
	"database/sql"
)

type notificationResponse struct {
	ID               int64   `json:"id"`
	UserID           int64   `json:"user_id"`
	ActorID          *int64  `json:"actor_id,omitempty"`
	NotificationType string  `json:"notification_type"`
	EntityType       *string `json:"entity_type,omitempty"`
	EntityID         *int64  `json:"entity_id,omitempty"`
	ReadAt           *string `json:"read_at,omitempty"`
	CreatedAt        string  `json:"created_at"`
}

type execContexter interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func createNotification(ctx context.Context, execer execContexter, userID int64, actorID int64, notificationType string, entityType string, entityID int64) error {
	_, err := execer.ExecContext(
		ctx,
		`INSERT INTO notifications (user_id, actor_id, notification_type, entity_type, entity_id)
		 VALUES ($1, $2, $3, $4, $5)`,
		userID,
		actorID,
		notificationType,
		entityType,
		entityID,
	)
	return err
}
