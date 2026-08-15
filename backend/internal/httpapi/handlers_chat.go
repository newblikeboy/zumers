package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

type conversationCreateRequest struct {
	FriendID int64 `json:"friend_id"`
}

type messageCreateRequest struct {
	MessageType   string  `json:"message_type"`
	Content       *string `json:"content"`
	MediaURL      *string `json:"media_url"`
	MediaPublicID *string `json:"media_public_id"`
}

type conversationResponse struct {
	ID        int64            `json:"id"`
	UserOneID int64            `json:"user_one_id"`
	UserTwoID int64            `json:"user_two_id"`
	OtherUser userResponse     `json:"other_user"`
	Latest    *messageResponse `json:"latest_message,omitempty"`
	CreatedAt string           `json:"created_at"`
	UpdatedAt string           `json:"updated_at"`
}

type messageResponse struct {
	ID             int64   `json:"id"`
	ConversationID int64   `json:"conversation_id"`
	SenderID       int64   `json:"sender_id"`
	MessageType    string  `json:"message_type"`
	Content        *string `json:"content,omitempty"`
	MediaURL       *string `json:"media_url,omitempty"`
	MediaPublicID  *string `json:"media_public_id,omitempty"`
	DeliveredAt    *string `json:"delivered_at,omitempty"`
	ReadAt         *string `json:"read_at,omitempty"`
	CreatedAt      string  `json:"created_at"`
}

type messageReceiptResponse struct {
	ConversationID int64    `json:"conversation_id"`
	MessageIDs     []int64  `json:"message_ids"`
	DeliveredAt    *string  `json:"delivered_at,omitempty"`
	ReadAt         *string  `json:"read_at,omitempty"`
	ReaderID       int64    `json:"reader_id,omitempty"`
	RecipientID    int64    `json:"recipient_id,omitempty"`
}

func (s *Server) handleConversationCreate(w http.ResponseWriter, r *http.Request) {
	var req conversationCreateRequest
	if err := decodeJSON(r, &req); err != nil || req.FriendID <= 0 {
		writeError(w, http.StatusBadRequest, "friend_id is required")
		return
	}

	userID := currentUserID(r)
	if userID == req.FriendID {
		writeError(w, http.StatusBadRequest, "cannot create a conversation with yourself")
		return
	}
	if !areFriends(r.Context(), s.db, userID, req.FriendID) {
		writeError(w, http.StatusForbidden, "chat is only allowed between friends")
		return
	}

	firstID, secondID := sortedUserPair(userID, req.FriendID)
	var conversationID int64
	err := s.db.QueryRowContext(
		r.Context(),
		`INSERT INTO conversations (user_one_id, user_two_id)
		 VALUES ($1, $2)
		 ON CONFLICT (user_one_id, user_two_id)
		 DO UPDATE SET updated_at = conversations.updated_at
		 RETURNING id`,
		firstID,
		secondID,
	).Scan(&conversationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create conversation")
		return
	}

	conversation, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load conversation")
		return
	}

	writeJSON(w, http.StatusCreated, conversation)
}

func (s *Server) handleConversationsList(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(r)
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT c.id, c.user_one_id, c.user_two_id, c.created_at::text, c.updated_at::text
		 FROM conversations c
		 WHERE c.user_one_id = $1 OR c.user_two_id = $1
		 ORDER BY c.updated_at DESC
		 LIMIT $2`,
		userID,
		pageLimit(r, 50, 100),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load conversations")
		return
	}
	defer rows.Close()

	conversations := make([]conversationResponse, 0)
	for rows.Next() {
		var item conversationResponse
		if err := rows.Scan(&item.ID, &item.UserOneID, &item.UserTwoID, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read conversations")
			return
		}
		item.OtherUser, _ = s.getUserResponse(r.Context(), otherParticipant(item.UserOneID, item.UserTwoID, userID))
		latest, err := s.getLatestMessage(r.Context(), item.ID)
		if err == nil {
			item.Latest = &latest
		}
		conversations = append(conversations, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{"conversations": conversations})
}

func (s *Server) handleMessageCreate(w http.ResponseWriter, r *http.Request) {
	conversationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	var req messageCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	message, err := s.createMessage(r.Context(), currentUserID(r), conversationID, req)
	if errors.Is(err, errNotConversationParticipant) {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	recipientID, _ := s.conversationRecipient(r.Context(), conversationID, message.SenderID)
	delivered := s.chatHub.SendToUser(recipientID, "message.created", message) > 0
	if delivered {
		if deliveredAt, err := s.markMessageDelivered(r.Context(), message.ID, recipientID); err == nil && deliveredAt != nil {
			message.DeliveredAt = deliveredAt
			receipt := messageReceiptResponse{
				ConversationID: message.ConversationID,
				MessageIDs:     []int64{message.ID},
				DeliveredAt:    deliveredAt,
				RecipientID:    recipientID,
			}
			s.chatHub.SendToUser(message.SenderID, "message.delivered", receipt)
			s.chatHub.SendToUser(recipientID, "message.delivered", receipt)
		}
	}
	s.chatHub.SendToUser(message.SenderID, "message.created", message)

	writeJSON(w, http.StatusCreated, message)
}

func (s *Server) handleMessageHistory(w http.ResponseWriter, r *http.Request) {
	conversationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}
	if !s.isConversationParticipant(r.Context(), conversationID, currentUserID(r)) {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}

	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT id, conversation_id, sender_id, message_type, content, media_url, media_public_id, delivered_at::text, read_at::text, created_at::text
		 FROM messages
		 WHERE conversation_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT $2`,
		conversationID,
		pageLimit(r, 50, 100),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load messages")
		return
	}
	defer rows.Close()

	messages := make([]messageResponse, 0)
	for rows.Next() {
		message, err := scanMessage(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read messages")
			return
		}
		messages = append(messages, message)
	}

	writeJSON(w, http.StatusOK, map[string]any{"messages": messages})
}

func (s *Server) handleConversationRead(w http.ResponseWriter, r *http.Request) {
	conversationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}
	if !s.isConversationParticipant(r.Context(), conversationID, currentUserID(r)) {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}

	receipt, err := s.markConversationRead(r.Context(), conversationID, currentUserID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not mark conversation read")
		return
	}

	senderID, _ := s.conversationRecipient(r.Context(), conversationID, currentUserID(r))
	s.chatHub.SendToUser(senderID, "conversation.read", receipt)
	s.chatHub.SendToUser(currentUserID(r), "conversation.read", receipt)

	writeJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func (s *Server) createMessage(ctx context.Context, senderID int64, conversationID int64, req messageCreateRequest) (messageResponse, error) {
	userOneID, userTwoID, err := s.conversationParticipants(ctx, conversationID)
	if err != nil {
		return messageResponse{}, errNotConversationParticipant
	}
	if senderID != userOneID && senderID != userTwoID {
		return messageResponse{}, errNotConversationParticipant
	}
	recipientID := otherParticipant(userOneID, userTwoID, senderID)
	if !areFriends(ctx, s.db, senderID, recipientID) {
		return messageResponse{}, errors.New("chat is only allowed between friends")
	}

	req.MessageType = cleanMessageType(req.MessageType)
	req.Content = cleanOptionalText(req.Content)
	req.MediaURL = cleanOptionalText(req.MediaURL)
	req.MediaPublicID = cleanOptionalText(req.MediaPublicID)
	if req.MessageType == "text" && req.Content == nil {
		return messageResponse{}, errors.New("content is required for text messages")
	}
	if (req.MessageType == "image" || req.MessageType == "video") && req.MediaURL == nil {
		return messageResponse{}, errors.New("media_url is required for media messages")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return messageResponse{}, err
	}
	defer tx.Rollback()

	var message messageResponse
	var content, mediaURL, mediaPublicID, deliveredAt, readAt sql.NullString
	err = tx.QueryRowContext(
		ctx,
		`INSERT INTO messages (conversation_id, sender_id, message_type, content, media_url, media_public_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, conversation_id, sender_id, message_type, content, media_url, media_public_id, delivered_at::text, read_at::text, created_at::text`,
		conversationID,
		senderID,
		req.MessageType,
		req.Content,
		req.MediaURL,
		req.MediaPublicID,
	).Scan(&message.ID, &message.ConversationID, &message.SenderID, &message.MessageType, &content, &mediaURL, &mediaPublicID, &deliveredAt, &readAt, &message.CreatedAt)
	if err != nil {
		return messageResponse{}, err
	}

	_, err = tx.ExecContext(ctx, `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, conversationID)
	if err != nil {
		return messageResponse{}, err
	}
	_ = createNotification(ctx, tx, recipientID, senderID, "message", "message", message.ID)

	if err := tx.Commit(); err != nil {
		return messageResponse{}, err
	}

	message.Content = nullableString(content)
	message.MediaURL = nullableString(mediaURL)
	message.MediaPublicID = nullableString(mediaPublicID)
	message.DeliveredAt = nullableString(deliveredAt)
	message.ReadAt = nullableString(readAt)
	return message, nil
}

func (s *Server) getConversation(ctx context.Context, conversationID int64, viewerID int64) (conversationResponse, error) {
	var item conversationResponse
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, user_one_id, user_two_id, created_at::text, updated_at::text
		 FROM conversations
		 WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)`,
		conversationID,
		viewerID,
	).Scan(&item.ID, &item.UserOneID, &item.UserTwoID, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return conversationResponse{}, err
	}

	item.OtherUser, err = s.getUserResponse(ctx, otherParticipant(item.UserOneID, item.UserTwoID, viewerID))
	return item, err
}

func (s *Server) getLatestMessage(ctx context.Context, conversationID int64) (messageResponse, error) {
	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, conversation_id, sender_id, message_type, content, media_url, media_public_id, delivered_at::text, read_at::text, created_at::text
		 FROM messages
		 WHERE conversation_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at DESC
		 LIMIT 1`,
		conversationID,
	)
	return scanMessage(row)
}

func (s *Server) isConversationParticipant(ctx context.Context, conversationID int64, userID int64) bool {
	_, _, err := s.conversationParticipantsForUser(ctx, conversationID, userID)
	return err == nil
}

func (s *Server) conversationRecipient(ctx context.Context, conversationID int64, senderID int64) (int64, error) {
	userOneID, userTwoID, err := s.conversationParticipantsForUser(ctx, conversationID, senderID)
	if err != nil {
		return 0, err
	}
	return otherParticipant(userOneID, userTwoID, senderID), nil
}

func (s *Server) conversationParticipants(ctx context.Context, conversationID int64) (int64, int64, error) {
	var userOneID, userTwoID int64
	err := s.db.QueryRowContext(ctx, `SELECT user_one_id, user_two_id FROM conversations WHERE id = $1`, conversationID).Scan(&userOneID, &userTwoID)
	return userOneID, userTwoID, err
}

func (s *Server) conversationParticipantsForUser(ctx context.Context, conversationID int64, userID int64) (int64, int64, error) {
	var userOneID, userTwoID int64
	err := s.db.QueryRowContext(
		ctx,
		`SELECT user_one_id, user_two_id
		 FROM conversations
		 WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)`,
		conversationID,
		userID,
	).Scan(&userOneID, &userTwoID)
	return userOneID, userTwoID, err
}

type messageScanner interface {
	Scan(dest ...any) error
}

func scanMessage(scanner messageScanner) (messageResponse, error) {
	var message messageResponse
	var content, mediaURL, mediaPublicID, deliveredAt, readAt sql.NullString
	err := scanner.Scan(
		&message.ID,
		&message.ConversationID,
		&message.SenderID,
		&message.MessageType,
		&content,
		&mediaURL,
		&mediaPublicID,
		&deliveredAt,
		&readAt,
		&message.CreatedAt,
	)
	if err != nil {
		return messageResponse{}, err
	}
	message.Content = nullableString(content)
	message.MediaURL = nullableString(mediaURL)
	message.MediaPublicID = nullableString(mediaPublicID)
	message.DeliveredAt = nullableString(deliveredAt)
	message.ReadAt = nullableString(readAt)
	return message, nil
}

func (s *Server) markMessageDelivered(ctx context.Context, messageID int64, recipientID int64) (*string, error) {
	var deliveredAt sql.NullString
	err := s.db.QueryRowContext(
		ctx,
		`UPDATE messages
		 SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
		 WHERE id = $1 AND sender_id <> $2
		 RETURNING delivered_at::text`,
		messageID,
		recipientID,
	).Scan(&deliveredAt)
	if err != nil {
		return nil, err
	}

	return nullableString(deliveredAt), nil
}

func (s *Server) markConversationRead(ctx context.Context, conversationID int64, readerID int64) (messageReceiptResponse, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`UPDATE messages
		 SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
		     read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
		 WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL
		 RETURNING id, read_at::text`,
		conversationID,
		readerID,
	)
	if err != nil {
		return messageReceiptResponse{}, err
	}
	defer rows.Close()

	receipt := messageReceiptResponse{
		ConversationID: conversationID,
		ReaderID:       readerID,
		MessageIDs:     make([]int64, 0),
	}
	for rows.Next() {
		var messageID int64
		var readAt sql.NullString
		if err := rows.Scan(&messageID, &readAt); err != nil {
			return messageReceiptResponse{}, err
		}
		receipt.MessageIDs = append(receipt.MessageIDs, messageID)
		if readAt.Valid {
			value := readAt.String
			receipt.ReadAt = &value
		}
	}
	if err := rows.Err(); err != nil {
		return messageReceiptResponse{}, err
	}

	return receipt, nil
}

func otherParticipant(userOneID int64, userTwoID int64, userID int64) int64 {
	if userID == userOneID {
		return userTwoID
	}
	return userOneID
}

func cleanMessageType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "image", "video":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "text"
	}
}

var errNotConversationParticipant = errors.New("conversation participant not found")
