package httpapi

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/jackc/pgconn"
)

type friendRequestCreateRequest struct {
	ReceiverID int64 `json:"receiver_id"`
}

type friendRequestResponse struct {
	ID         int64         `json:"id"`
	SenderID   int64         `json:"sender_id"`
	ReceiverID int64         `json:"receiver_id"`
	Sender     *userResponse `json:"sender,omitempty"`
	Receiver   *userResponse `json:"receiver,omitempty"`
	Status     string        `json:"status"`
	CreatedAt  string        `json:"created_at"`
	UpdatedAt  string        `json:"updated_at"`
}

func (s *Server) handleFriendRequestCreate(w http.ResponseWriter, r *http.Request) {
	var req friendRequestCreateRequest
	if err := decodeJSON(r, &req); err != nil || req.ReceiverID <= 0 {
		writeError(w, http.StatusBadRequest, "receiver_id is required")
		return
	}

	senderID := currentUserID(r)
	if senderID == req.ReceiverID {
		writeError(w, http.StatusBadRequest, "cannot send a friend request to yourself")
		return
	}

	if areFriends(r.Context(), s.db, senderID, req.ReceiverID) {
		writeError(w, http.StatusConflict, "users are already friends")
		return
	}

	var receiverExists bool
	err := s.db.QueryRowContext(
		r.Context(),
		`SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND account_status = 'active')`,
		req.ReceiverID,
	).Scan(&receiverExists)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not verify receiver")
		return
	}
	if !receiverExists {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	var existingSenderID, existingReceiverID int64
	err = s.db.QueryRowContext(
		r.Context(),
		`SELECT sender_id, receiver_id
		 FROM friend_requests
		 WHERE status = 'pending'
		   AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
		 LIMIT 1`,
		senderID,
		req.ReceiverID,
	).Scan(&existingSenderID, &existingReceiverID)
	if err == nil {
		if existingSenderID == senderID {
			writeError(w, http.StatusConflict, "friend request is already pending")
			return
		}
		writeError(w, http.StatusConflict, "this user already sent you a friend request")
		return
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "could not check friend request")
		return
	}

	var response friendRequestResponse
	err = s.db.QueryRowContext(
		r.Context(),
		`INSERT INTO friend_requests (sender_id, receiver_id)
		 VALUES ($1, $2)
		 RETURNING id, sender_id, receiver_id, status, created_at::text, updated_at::text`,
		senderID,
		req.ReceiverID,
	).Scan(&response.ID, &response.SenderID, &response.ReceiverID, &response.Status, &response.CreatedAt, &response.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case "23505":
				writeError(w, http.StatusConflict, "friend request is already pending")
				return
			case "23503":
				writeError(w, http.StatusNotFound, "user not found")
				return
			}
		}

		s.logger.Error("friend request insert failed", "error", err)
		writeError(w, http.StatusInternalServerError, "friend request could not be created")
		return
	}

	receiver, err := s.getUserResponse(r.Context(), req.ReceiverID)
	if err == nil {
		response.Receiver = &receiver
	}

	_ = createNotification(r.Context(), s.db, req.ReceiverID, senderID, "friend_request", "friend_request", response.ID)

	writeJSON(w, http.StatusCreated, response)
}

func (s *Server) handleFriendRequestsList(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(r)
	direction := r.URL.Query().Get("direction")

	condition := "receiver_id = $1"
	if direction == "outgoing" {
		condition = "sender_id = $1"
	}

	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT id, sender_id, receiver_id, status, created_at::text, updated_at::text
		 FROM friend_requests
		 WHERE `+condition+`
		   AND status = 'pending'
		 ORDER BY created_at DESC
		 LIMIT $2`,
		userID,
		pageLimit(r, 50, 100),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load friend requests")
		return
	}
	defer rows.Close()

	requests := make([]friendRequestResponse, 0)
	for rows.Next() {
		var item friendRequestResponse
		if err := rows.Scan(&item.ID, &item.SenderID, &item.ReceiverID, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read friend requests")
			return
		}
		if sender, err := s.getUserResponse(r.Context(), item.SenderID); err == nil {
			item.Sender = &sender
		}
		if receiver, err := s.getUserResponse(r.Context(), item.ReceiverID); err == nil {
			item.Receiver = &receiver
		}
		requests = append(requests, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{"friend_requests": requests})
}

func (s *Server) handleFriendRequestAccept(w http.ResponseWriter, r *http.Request) {
	requestID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid friend request id")
		return
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not accept friend request")
		return
	}
	defer tx.Rollback()

	var senderID, receiverID int64
	err = tx.QueryRowContext(
		r.Context(),
		`SELECT sender_id, receiver_id
		 FROM friend_requests
		 WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
		 FOR UPDATE`,
		requestID,
		currentUserID(r),
	).Scan(&senderID, &receiverID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "pending friend request not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not accept friend request")
		return
	}

	_, err = tx.ExecContext(r.Context(), `UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, requestID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not accept friend request")
		return
	}

	_, err = tx.ExecContext(
		r.Context(),
		`UPDATE friend_requests
		 SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
		 WHERE status = 'pending'
		   AND sender_id = $1
		   AND receiver_id = $2
		   AND id <> $3`,
		receiverID,
		senderID,
		requestID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not clear duplicate friend request")
		return
	}

	firstID, secondID := sortedUserPair(senderID, receiverID)
	_, err = tx.ExecContext(
		r.Context(),
		`INSERT INTO friendships (user_id, friend_id)
		 VALUES ($1, $2)
		 ON CONFLICT (user_id, friend_id) DO NOTHING`,
		firstID,
		secondID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create friendship")
		return
	}

	_ = createNotification(r.Context(), tx, senderID, receiverID, "friend_accept", "friendship", requestID)

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not accept friend request")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

func (s *Server) handleFriendRequestReject(w http.ResponseWriter, r *http.Request) {
	requestID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid friend request id")
		return
	}

	result, err := s.db.ExecContext(
		r.Context(),
		`UPDATE friend_requests
		 SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
		requestID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not reject friend request")
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "pending friend request not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "rejected"})
}

func (s *Server) handleFriendsList(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(r)
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT u.id, u.email, u.date_of_birth::text, u.account_status,
		        p.display_name, p.username, p.bio, p.location, p.avatar_url, p.avatar_public_id, p.cover_url, p.cover_public_id, p.profile_visibility,
		        u.created_at, u.updated_at
		 FROM friendships f
		 JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
		 JOIN profiles p ON p.user_id = u.id
		 WHERE f.user_id = $1 OR f.friend_id = $1
		 ORDER BY p.display_name
		 LIMIT $2`,
		userID,
		pageLimit(r, 50, 100),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load friends")
		return
	}
	defer rows.Close()

	friends := make([]userResponse, 0)
	for rows.Next() {
		user, err := scanUserResponse(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read friends")
			return
		}
		friends = append(friends, user)
	}

	writeJSON(w, http.StatusOK, map[string]any{"friends": friends})
}

func (s *Server) handleUnfriend(w http.ResponseWriter, r *http.Request) {
	friendID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid friend id")
		return
	}

	firstID, secondID := sortedUserPair(currentUserID(r), friendID)
	result, err := s.db.ExecContext(r.Context(), `DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2`, firstID, secondID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not unfriend user")
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "friendship not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
