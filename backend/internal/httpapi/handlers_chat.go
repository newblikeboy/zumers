package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

type conversationCreateRequest struct {
	FriendID  int64   `json:"friend_id"`
	Title     *string `json:"title"`
	MemberIDs []int64 `json:"member_ids"`
}

type messageCreateRequest struct {
	MessageType   string  `json:"message_type"`
	Content       *string `json:"content"`
	MediaURL      *string `json:"media_url"`
	MediaPublicID *string `json:"media_public_id"`
}

type conversationResponse struct {
	ID               int64            `json:"id"`
	UserOneID        int64            `json:"user_one_id"`
	UserTwoID        *int64           `json:"user_two_id,omitempty"`
	ConversationType string           `json:"conversation_type"`
	Title            *string          `json:"title,omitempty"`
	CreatedBy        *int64           `json:"created_by,omitempty"`
	OtherUser        *userResponse    `json:"other_user,omitempty"`
	Members          []userResponse   `json:"members"`
	MemberCount      int              `json:"member_count"`
	Latest           *messageResponse `json:"latest_message,omitempty"`
	CreatedAt        string           `json:"created_at"`
	UpdatedAt        string           `json:"updated_at"`
}

type messageResponse struct {
	ID             int64                `json:"id"`
	ConversationID int64                `json:"conversation_id"`
	SenderID       int64                `json:"sender_id"`
	MessageType    string               `json:"message_type"`
	Content        *string              `json:"content,omitempty"`
	MediaURL       *string              `json:"media_url,omitempty"`
	MediaPublicID  *string              `json:"media_public_id,omitempty"`
	DeliveredAt    *string              `json:"delivered_at,omitempty"`
	ReadAt         *string              `json:"read_at,omitempty"`
	RecipientCount int                  `json:"recipient_count"`
	DeliveredCount int                  `json:"delivered_count"`
	ReadCount      int                  `json:"read_count"`
	Receipts       []messageReceiptItem `json:"receipts,omitempty"`
	CreatedAt      string               `json:"created_at"`
}

type messageReceiptResponse struct {
	ConversationID int64                `json:"conversation_id"`
	MessageIDs     []int64              `json:"message_ids"`
	Messages       []messageReceiptItem `json:"messages,omitempty"`
	DeliveredAt    *string              `json:"delivered_at,omitempty"`
	ReadAt         *string              `json:"read_at,omitempty"`
	ReaderID       int64                `json:"reader_id,omitempty"`
	RecipientID    int64                `json:"recipient_id,omitempty"`
	RecipientIDs   []int64              `json:"recipient_ids,omitempty"`
}

type messageReceiptItem struct {
	MessageID      int64         `json:"message_id"`
	UserID         int64         `json:"user_id,omitempty"`
	User           *userResponse `json:"user,omitempty"`
	DeliveredAt    *string       `json:"delivered_at,omitempty"`
	ReadAt         *string       `json:"read_at,omitempty"`
	RecipientCount int           `json:"recipient_count"`
	DeliveredCount int           `json:"delivered_count"`
	ReadCount      int           `json:"read_count"`
}

func (s *Server) handleConversationCreate(w http.ResponseWriter, r *http.Request) {
	var req conversationCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	userID := currentUserID(r)
	if len(req.MemberIDs) > 0 || req.Title != nil {
		conversation, err := s.createGroupConversation(r.Context(), userID, req)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, conversation)
		return
	}

	if req.FriendID <= 0 {
		writeError(w, http.StatusBadRequest, "friend_id is required")
		return
	}
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
		`INSERT INTO conversations (user_one_id, user_two_id, conversation_type)
		 VALUES ($1, $2, 'direct')
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
	_ = s.ensureConversationMember(r.Context(), conversationID, firstID, "member")
	_ = s.ensureConversationMember(r.Context(), conversationID, secondID, "member")

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
		`SELECT c.id, c.user_one_id, c.user_two_id, c.conversation_type, c.title, c.created_by, c.created_at::text, c.updated_at::text
		 FROM conversations c
		 JOIN conversation_members cm ON cm.conversation_id = c.id
		 WHERE cm.user_id = $1 AND cm.left_at IS NULL
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
		item, err := scanConversation(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read conversations")
			return
		}
		_ = s.hydrateConversation(r.Context(), &item, userID)
		latest, err := s.getLatestMessage(r.Context(), item.ID)
		if err == nil {
			item.Latest = &latest
		}
		conversations = append(conversations, item)
	}

	writeJSON(w, http.StatusOK, map[string]any{"conversations": conversations})
}

func (s *Server) createGroupConversation(ctx context.Context, userID int64, req conversationCreateRequest) (conversationResponse, error) {
	title := ""
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	if title == "" {
		return conversationResponse{}, errors.New("group name is required")
	}
	if len(title) > 120 {
		return conversationResponse{}, errors.New("group name must be 120 characters or fewer")
	}

	memberIDs := uniquePositiveIDs(req.MemberIDs, userID)
	if len(memberIDs) < 2 {
		return conversationResponse{}, errors.New("select at least two friends for a group")
	}
	for _, memberID := range memberIDs {
		if !areFriends(ctx, s.db, userID, memberID) {
			return conversationResponse{}, errors.New("groups can only include your friends")
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return conversationResponse{}, err
	}
	defer tx.Rollback()

	var conversationID int64
	err = tx.QueryRowContext(
		ctx,
		`INSERT INTO conversations (conversation_type, title, created_by, user_one_id)
		 VALUES ('group', $1, $2, $2)
		 RETURNING id`,
		title,
		userID,
	).Scan(&conversationID)
	if err != nil {
		return conversationResponse{}, err
	}

	if err := insertConversationMember(ctx, tx, conversationID, userID, "owner"); err != nil {
		return conversationResponse{}, err
	}
	for _, memberID := range memberIDs {
		if err := insertConversationMember(ctx, tx, conversationID, memberID, "member"); err != nil {
			return conversationResponse{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return conversationResponse{}, err
	}

	return s.getConversation(ctx, conversationID, userID)
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

	s.deliverMessageToConversation(r.Context(), message)
	_ = s.hydrateMessageReceiptCounts(r.Context(), &message)
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
		_ = s.hydrateMessageReceiptCounts(r.Context(), &message)
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

	memberIDs, _ := s.conversationMemberIDs(r.Context(), conversationID)
	for _, memberID := range memberIDs {
		s.chatHub.SendToUser(memberID, "conversation.read", receipt)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "read"})
}

func (s *Server) createMessage(ctx context.Context, senderID int64, conversationID int64, req messageCreateRequest) (messageResponse, error) {
	conversation, err := s.getConversation(ctx, conversationID, senderID)
	if err != nil {
		return messageResponse{}, errNotConversationParticipant
	}
	if conversation.ConversationType == "direct" && conversation.UserTwoID != nil {
		recipientID := otherParticipant(conversation.UserOneID, *conversation.UserTwoID, senderID)
		if !areFriends(ctx, s.db, senderID, recipientID) {
			return messageResponse{}, errors.New("chat is only allowed between friends")
		}
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
	if err := insertMessageReceipts(ctx, tx, message.ID, senderID, conversation); err != nil {
		return messageResponse{}, err
	}
	for _, member := range conversation.Members {
		if member.ID == senderID {
			continue
		}
		_ = createNotification(ctx, tx, member.ID, senderID, "message", "message", message.ID)
	}

	if err := tx.Commit(); err != nil {
		return messageResponse{}, err
	}

	message.Content = nullableString(content)
	message.MediaURL = nullableString(mediaURL)
	message.MediaPublicID = nullableString(mediaPublicID)
	message.DeliveredAt = nullableString(deliveredAt)
	message.ReadAt = nullableString(readAt)
	message.RecipientCount = maxInt(0, len(conversation.Members)-1)
	return message, nil
}

func (s *Server) getConversation(ctx context.Context, conversationID int64, viewerID int64) (conversationResponse, error) {
	item, err := scanConversation(s.db.QueryRowContext(
		ctx,
		`SELECT c.id, c.user_one_id, c.user_two_id, c.conversation_type, c.title, c.created_by, c.created_at::text, c.updated_at::text
		 FROM conversations c
		 JOIN conversation_members cm ON cm.conversation_id = c.id
		 WHERE c.id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL`,
		conversationID,
		viewerID,
	))
	if err != nil {
		return conversationResponse{}, err
	}

	if err := s.hydrateConversation(ctx, &item, viewerID); err != nil {
		return conversationResponse{}, err
	}
	return item, nil
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
	message, err := scanMessage(row)
	if err != nil {
		return messageResponse{}, err
	}
	_ = s.hydrateMessageReceiptCounts(ctx, &message)
	return message, nil
}

func (s *Server) isConversationParticipant(ctx context.Context, conversationID int64, userID int64) bool {
	var exists bool
	err := s.db.QueryRowContext(
		ctx,
		`SELECT EXISTS (
		   SELECT 1
		   FROM conversation_members
		   WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
		 )`,
		conversationID,
		userID,
	).Scan(&exists)
	return err == nil && exists
}

func (s *Server) conversationMemberIDs(ctx context.Context, conversationID int64) ([]int64, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT user_id
		 FROM conversation_members
		 WHERE conversation_id = $1 AND left_at IS NULL
		 ORDER BY joined_at, id`,
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memberIDs := make([]int64, 0)
	for rows.Next() {
		var memberID int64
		if err := rows.Scan(&memberID); err != nil {
			return nil, err
		}
		memberIDs = append(memberIDs, memberID)
	}
	return memberIDs, rows.Err()
}

func (s *Server) conversationMemberRoles(ctx context.Context, conversationID int64) (map[int64]string, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT user_id, role
		 FROM conversation_members
		 WHERE conversation_id = $1 AND left_at IS NULL`,
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rolesByUserID := make(map[int64]string)
	for rows.Next() {
		var userID int64
		var role string
		if err := rows.Scan(&userID, &role); err != nil {
			return nil, err
		}
		rolesByUserID[userID] = role
	}
	return rolesByUserID, rows.Err()
}

func (s *Server) hydrateConversation(ctx context.Context, item *conversationResponse, viewerID int64) error {
	memberIDs, err := s.conversationMemberIDs(ctx, item.ID)
	if err != nil {
		return err
	}
	usersByID, err := s.getUserResponsesByID(ctx, memberIDs)
	if err != nil {
		return err
	}
	rolesByUserID, err := s.conversationMemberRoles(ctx, item.ID)
	if err != nil {
		return err
	}

	item.Members = make([]userResponse, 0, len(memberIDs))
	for _, memberID := range memberIDs {
		if user, exists := usersByID[memberID]; exists {
			if role, exists := rolesByUserID[memberID]; exists {
				user.Role = &role
			}
			item.Members = append(item.Members, user)
		}
	}
	item.MemberCount = len(item.Members)

	if item.ConversationType == "direct" && item.UserTwoID != nil {
		otherID := otherParticipant(item.UserOneID, *item.UserTwoID, viewerID)
		if otherUser, err := s.getUserResponse(ctx, otherID); err == nil {
			item.OtherUser = &otherUser
		}
	}

	return nil
}

func (s *Server) ensureConversationMember(ctx context.Context, conversationID int64, userID int64, role string) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO conversation_members (conversation_id, user_id, role)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (conversation_id, user_id) DO NOTHING`,
		conversationID,
		userID,
		role,
	)
	return err
}

func insertConversationMember(ctx context.Context, tx *sql.Tx, conversationID int64, userID int64, role string) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO conversation_members (conversation_id, user_id, role)
		 VALUES ($1, $2, $3)`,
		conversationID,
		userID,
		role,
	)
	return err
}

func insertMessageReceipts(ctx context.Context, tx *sql.Tx, messageID int64, senderID int64, conversation conversationResponse) error {
	for _, member := range conversation.Members {
		if member.ID == 0 || member.ID == senderID {
			continue
		}
		_, err := tx.ExecContext(
			ctx,
			`INSERT INTO message_receipts (message_id, conversation_id, user_id)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (message_id, user_id) DO NOTHING`,
			messageID,
			conversation.ID,
			member.ID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) deliverMessageToConversation(ctx context.Context, message messageResponse) {
	memberIDs, err := s.conversationMemberIDs(ctx, message.ConversationID)
	if err != nil {
		return
	}

	deliveredTo := make([]int64, 0)
	for _, memberID := range memberIDs {
		if memberID == message.SenderID {
			continue
		}
		if s.chatHub.SendToUser(memberID, "message.created", message) > 0 {
			deliveredTo = append(deliveredTo, memberID)
		}
	}
	if len(deliveredTo) == 0 {
		return
	}

	if receipt, err := s.markMessageDeliveredForRecipients(ctx, message.ID, deliveredTo); err == nil {
		s.chatHub.SendToUser(message.SenderID, "message.delivered", receipt)
		for _, memberID := range deliveredTo {
			s.chatHub.SendToUser(memberID, "message.delivered", receipt)
		}
	}
}

func (s *Server) markMessageDeliveredForRecipients(ctx context.Context, messageID int64, recipientIDs []int64) (messageReceiptResponse, error) {
	var conversationID int64
	err := s.db.QueryRowContext(ctx, `SELECT conversation_id FROM messages WHERE id = $1`, messageID).Scan(&conversationID)
	if err != nil {
		return messageReceiptResponse{}, err
	}

	var deliveredAt *string
	for _, recipientID := range recipientIDs {
		var value sql.NullString
		err := s.db.QueryRowContext(
			ctx,
			`UPDATE message_receipts
			 SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE message_id = $1 AND user_id = $2
			 RETURNING delivered_at::text`,
			messageID,
			recipientID,
		).Scan(&value)
		if err != nil {
			return messageReceiptResponse{}, err
		}
		if value.Valid {
			text := value.String
			deliveredAt = &text
		}
	}

	item, err := s.messageReceiptSnapshot(ctx, messageID)
	if err != nil {
		return messageReceiptResponse{}, err
	}
	if err := s.syncMessageAggregateReceipts(ctx, item); err != nil {
		return messageReceiptResponse{}, err
	}

	return messageReceiptResponse{
		ConversationID: conversationID,
		MessageIDs:     []int64{messageID},
		Messages:       []messageReceiptItem{item},
		DeliveredAt:    deliveredAt,
		RecipientIDs:   recipientIDs,
	}, nil
}

func (s *Server) hydrateMessageReceiptCounts(ctx context.Context, message *messageResponse) error {
	item, err := s.messageReceiptSnapshot(ctx, message.ID)
	if err != nil {
		return err
	}
	message.RecipientCount = item.RecipientCount
	message.DeliveredCount = item.DeliveredCount
	message.ReadCount = item.ReadCount
	receipts, err := s.messageReceiptDetails(ctx, message.ID)
	if err != nil {
		return err
	}
	message.Receipts = receipts
	return nil
}

func (s *Server) messageReceiptSnapshot(ctx context.Context, messageID int64) (messageReceiptItem, error) {
	var item messageReceiptItem
	var deliveredAt, readAt sql.NullString
	err := s.db.QueryRowContext(
		ctx,
		`SELECT message_id,
		        COUNT(*)::int,
		        COUNT(delivered_at)::int,
		        COUNT(read_at)::int,
		        MAX(delivered_at)::text,
		        MAX(read_at)::text
		 FROM message_receipts
		 WHERE message_id = $1
		 GROUP BY message_id`,
		messageID,
	).Scan(
		&item.MessageID,
		&item.RecipientCount,
		&item.DeliveredCount,
		&item.ReadCount,
		&deliveredAt,
		&readAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		item.MessageID = messageID
		return item, nil
	}
	if err != nil {
		return messageReceiptItem{}, err
	}
	item.DeliveredAt = nullableString(deliveredAt)
	item.ReadAt = nullableString(readAt)
	return item, nil
}

func (s *Server) messageReceiptDetails(ctx context.Context, messageID int64) ([]messageReceiptItem, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT message_id, user_id, delivered_at::text, read_at::text
		 FROM message_receipts
		 WHERE message_id = $1
		 ORDER BY user_id`,
		messageID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	receipts := make([]messageReceiptItem, 0)
	userIDs := make([]int64, 0)
	for rows.Next() {
		var item messageReceiptItem
		var deliveredAt, readAt sql.NullString
		if err := rows.Scan(&item.MessageID, &item.UserID, &deliveredAt, &readAt); err != nil {
			return nil, err
		}
		item.DeliveredAt = nullableString(deliveredAt)
		item.ReadAt = nullableString(readAt)
		receipts = append(receipts, item)
		userIDs = append(userIDs, item.UserID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	usersByID, err := s.getUserResponsesByID(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	for index := range receipts {
		if user, exists := usersByID[receipts[index].UserID]; exists {
			receipts[index].User = &user
		}
	}

	return receipts, nil
}

func (s *Server) syncMessageAggregateReceipts(ctx context.Context, item messageReceiptItem) error {
	if item.RecipientCount <= 0 {
		return nil
	}
	if item.DeliveredCount >= item.RecipientCount {
		if _, err := s.db.ExecContext(
			ctx,
			`UPDATE messages
			 SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
			 WHERE id = $1`,
			item.MessageID,
		); err != nil {
			return err
		}
	}
	if item.ReadCount >= item.RecipientCount {
		if _, err := s.db.ExecContext(
			ctx,
			`UPDATE messages
			 SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
			     read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
			 WHERE id = $1`,
			item.MessageID,
		); err != nil {
			return err
		}
	}
	return nil
}

func scanConversation(scanner userScanner) (conversationResponse, error) {
	var item conversationResponse
	var userTwoID, createdBy sql.NullInt64
	var title sql.NullString
	err := scanner.Scan(
		&item.ID,
		&item.UserOneID,
		&userTwoID,
		&item.ConversationType,
		&title,
		&createdBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return conversationResponse{}, err
	}
	if userTwoID.Valid {
		value := userTwoID.Int64
		item.UserTwoID = &value
	}
	if title.Valid {
		value := title.String
		item.Title = &value
	}
	if createdBy.Valid {
		value := createdBy.Int64
		item.CreatedBy = &value
	}
	if item.ConversationType == "" {
		item.ConversationType = "direct"
	}
	return item, nil
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

func (s *Server) markConversationRead(ctx context.Context, conversationID int64, readerID int64) (messageReceiptResponse, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`UPDATE message_receipts
		 SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
		     read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE conversation_id = $1
		   AND user_id = $2
		   AND read_at IS NULL
		 RETURNING message_id, read_at::text`,
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
		Messages:       make([]messageReceiptItem, 0),
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
	for _, messageID := range receipt.MessageIDs {
		item, err := s.messageReceiptSnapshot(ctx, messageID)
		if err != nil {
			return messageReceiptResponse{}, err
		}
		if err := s.syncMessageAggregateReceipts(ctx, item); err != nil {
			return messageReceiptResponse{}, err
		}
		receipt.Messages = append(receipt.Messages, item)
	}

	return receipt, nil
}

func otherParticipant(userOneID int64, userTwoID int64, userID int64) int64 {
	if userID == userOneID {
		return userTwoID
	}
	return userOneID
}

func uniquePositiveIDs(values []int64, excludedID int64) []int64 {
	seen := make(map[int64]struct{}, len(values))
	ids := make([]int64, 0, len(values))
	for _, value := range values {
		if value <= 0 || value == excludedID {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		ids = append(ids, value)
	}
	return ids
}

func maxInt(first int, second int) int {
	if first > second {
		return first
	}
	return second
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
