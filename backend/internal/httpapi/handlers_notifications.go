package httpapi

import (
	"database/sql"
	"net/http"
)

func (s *Server) handleNotificationsList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT id, user_id, actor_id, notification_type, entity_type, entity_id, read_at::text, created_at::text
		 FROM notifications
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`,
		currentUserID(r),
		pageLimit(r, 50, 100),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load notifications")
		return
	}
	defer rows.Close()

	notifications := make([]notificationResponse, 0)
	for rows.Next() {
		var item notificationResponse
		var actorID, entityID sql.NullInt64
		var entityType, readAt sql.NullString
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&actorID,
			&item.NotificationType,
			&entityType,
			&entityID,
			&readAt,
			&item.CreatedAt,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read notifications")
			return
		}

		item.ActorID = nullableInt64(actorID)
		item.EntityType = nullableString(entityType)
		item.EntityID = nullableInt64(entityID)
		item.ReadAt = nullableString(readAt)
		notifications = append(notifications, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{"notifications": notifications})
}

func (s *Server) handleNotificationRead(w http.ResponseWriter, r *http.Request) {
	notificationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid notification id")
		return
	}

	result, err := s.db.ExecContext(
		r.Context(),
		`UPDATE notifications
		 SET read_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
		notificationID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not mark notification read")
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "unread notification not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func nullableInt64(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}

	return &value.Int64
}
