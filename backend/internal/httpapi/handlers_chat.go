package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type conversationCreateRequest struct {
	FriendID  int64   `json:"friend_id"`
	Title     *string `json:"title"`
	MemberIDs []int64 `json:"member_ids"`
}

type conversationMembersRequest struct {
	MemberIDs []int64 `json:"member_ids"`
}

type conversationUpdateRequest struct {
	Title          *string `json:"title"`
	AvatarURL      *string `json:"avatar_url"`
	AvatarPublicID *string `json:"avatar_public_id"`
}

type messageCreateRequest struct {
	MessageType   string  `json:"message_type"`
	Content       *string `json:"content"`
	MediaURL      *string `json:"media_url"`
	MediaPublicID *string `json:"media_public_id"`
}

type businessShareVoteRequest struct {
	Vote string `json:"vote"`
}

type conversationResponse struct {
	ID               int64            `json:"id"`
	UserOneID        int64            `json:"user_one_id"`
	UserTwoID        *int64           `json:"user_two_id,omitempty"`
	ConversationType string           `json:"conversation_type"`
	Title            *string          `json:"title,omitempty"`
	AvatarURL        *string          `json:"avatar_url,omitempty"`
	AvatarPublicID   *string          `json:"avatar_public_id,omitempty"`
	CreatedBy        *int64           `json:"created_by,omitempty"`
	OtherUser        *userResponse    `json:"other_user,omitempty"`
	Members          []userResponse   `json:"members"`
	MemberCount      int              `json:"member_count"`
	Latest           *messageResponse `json:"latest_message,omitempty"`
	UnreadCount      int              `json:"unread_count"`
	FirstUnreadID    *int64           `json:"first_unread_message_id,omitempty"`
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
	BusinessVote   *businessVoteSummary `json:"business_vote,omitempty"`
	CreatedAt      string               `json:"created_at"`
}

type businessVoteSummary struct {
	MessageID          int64   `json:"message_id"`
	LikeCount          int64   `json:"like_count"`
	DislikeCount       int64   `json:"dislike_count"`
	ParticipantCount   int64   `json:"participant_count"`
	MyVote             *string `json:"my_vote,omitempty"`
	AllLiked           bool    `json:"all_liked"`
	RecommendationText *string `json:"recommendation_text,omitempty"`
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
		`SELECT c.id, c.user_one_id, c.user_two_id, c.conversation_type, c.title, c.avatar_url, c.avatar_public_id, c.created_by, c.created_at::text, c.updated_at::text
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
	conversationIDs := make([]int64, 0)
	for rows.Next() {
		item, err := scanConversation(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read conversations")
			return
		}
		conversations = append(conversations, item)
		conversationIDs = append(conversationIDs, item.ID)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read conversations")
		return
	}

	if err := s.hydrateConversations(r.Context(), conversations, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not load conversation members")
		return
	}
	if err := s.hydrateUnreadSummaries(r.Context(), conversations, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not load unread messages")
		return
	}
	latestByConversationID, err := s.getLatestMessages(r.Context(), conversationIDs, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load latest messages")
		return
	}
	for index := range conversations {
		if latest, ok := latestByConversationID[conversations[index].ID]; ok {
			latestCopy := latest
			conversations[index].Latest = &latestCopy
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"conversations": conversations})
}

func (s *Server) handleConversationUpdate(w http.ResponseWriter, r *http.Request) {
	conversationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	var req conversationUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	userID := currentUserID(r)
	conversation, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}
	if conversation.ConversationType != "group" {
		writeError(w, http.StatusBadRequest, "only group conversations can be edited")
		return
	}
	if !isConversationOwner(conversation, userID) {
		writeError(w, http.StatusForbidden, "only group admins can edit this group")
		return
	}
	if req.Title == nil && req.AvatarURL == nil && req.AvatarPublicID == nil {
		writeJSON(w, http.StatusOK, conversation)
		return
	}

	var title any
	updateTitle := req.Title != nil
	if updateTitle {
		cleanTitle := strings.TrimSpace(*req.Title)
		if cleanTitle == "" {
			writeError(w, http.StatusBadRequest, "group name is required")
			return
		}
		if len(cleanTitle) > 120 {
			writeError(w, http.StatusBadRequest, "group name must be 120 characters or fewer")
			return
		}
		title = cleanTitle
	}

	var avatarURL any
	updateAvatarURL := req.AvatarURL != nil
	if updateAvatarURL {
		cleanAvatarURL := strings.TrimSpace(*req.AvatarURL)
		if cleanAvatarURL != "" {
			avatarURL = cleanAvatarURL
		}
	}

	var avatarPublicID any
	updateAvatarPublicID := req.AvatarPublicID != nil
	if updateAvatarPublicID {
		cleanAvatarPublicID := strings.TrimSpace(*req.AvatarPublicID)
		if cleanAvatarPublicID != "" {
			avatarPublicID = cleanAvatarPublicID
		}
	}

	_, err = s.db.ExecContext(
		r.Context(),
		`UPDATE conversations
		 SET title = CASE WHEN $2 THEN $3::VARCHAR(120) ELSE title END,
		     avatar_url = CASE WHEN $4 THEN $5::TEXT ELSE avatar_url END,
		     avatar_public_id = CASE WHEN $6 THEN $7::VARCHAR(255) ELSE avatar_public_id END,
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1`,
		conversationID,
		updateTitle,
		title,
		updateAvatarURL,
		avatarURL,
		updateAvatarPublicID,
		avatarPublicID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update group")
		return
	}

	updated, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load conversation")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleConversationMembersAdd(w http.ResponseWriter, r *http.Request) {
	conversationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	var req conversationMembersRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	userID := currentUserID(r)
	conversation, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}
	if conversation.ConversationType != "group" {
		writeError(w, http.StatusBadRequest, "members can only be added to groups")
		return
	}
	if !isConversationOwner(conversation, userID) {
		writeError(w, http.StatusForbidden, "only group admins can add members")
		return
	}

	existingMembers := make(map[int64]struct{}, len(conversation.Members))
	for _, member := range conversation.Members {
		existingMembers[member.ID] = struct{}{}
	}
	memberIDs := uniquePositiveIDs(req.MemberIDs, userID)
	added := 0
	for _, memberID := range memberIDs {
		if _, exists := existingMembers[memberID]; exists {
			continue
		}
		if !areFriends(r.Context(), s.db, userID, memberID) {
			writeError(w, http.StatusForbidden, "groups can only include your friends")
			return
		}
		if err := s.ensureConversationMember(r.Context(), conversationID, memberID, "member"); err != nil {
			writeError(w, http.StatusInternalServerError, "could not add member")
			return
		}
		added++
	}
	if added == 0 {
		writeError(w, http.StatusBadRequest, "select at least one new member")
		return
	}
	_, _ = s.db.ExecContext(
		r.Context(),
		`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		conversationID,
	)

	updated, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load conversation")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (s *Server) handleConversationMemberRemove(w http.ResponseWriter, r *http.Request) {
	conversationID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}
	memberID, err := parseID(r.PathValue("member_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid member id")
		return
	}

	userID := currentUserID(r)
	conversation, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}
	if conversation.ConversationType != "group" {
		writeError(w, http.StatusBadRequest, "members can only be removed from groups")
		return
	}
	if !isConversationOwner(conversation, userID) {
		writeError(w, http.StatusForbidden, "only group admins can remove members")
		return
	}
	if memberID == userID {
		writeError(w, http.StatusBadRequest, "group admin cannot remove themselves")
		return
	}
	if memberID == conversationOwnerID(conversation) {
		writeError(w, http.StatusBadRequest, "group admin cannot be removed")
		return
	}

	result, err := s.db.ExecContext(
		r.Context(),
		`UPDATE conversation_members
		 SET left_at = CURRENT_TIMESTAMP
		 WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL`,
		conversationID,
		memberID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove member")
		return
	}
	if rows, err := result.RowsAffected(); err != nil || rows == 0 {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	_, _ = s.db.ExecContext(
		r.Context(),
		`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
		conversationID,
	)

	updated, err := s.getConversation(r.Context(), conversationID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load conversation")
		return
	}
	writeJSON(w, http.StatusOK, updated)
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

	beforeID, err := optionalPositiveID(r.URL.Query().Get("before_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid before_id")
		return
	}
	anchorID, err := optionalPositiveID(r.URL.Query().Get("anchor_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid anchor_id")
		return
	}
	limit := pageLimit(r, 30, 100)
	args := []any{conversationID}
	query := ""
	if anchorID > 0 {
		args = append(args, anchorID, limit+1)
		query = `SELECT id, conversation_id, sender_id, message_type, content, media_url, media_public_id, delivered_at::text, read_at::text, created_at::text
		 FROM (
		   SELECT id, conversation_id, sender_id, message_type, content, media_url, media_public_id, delivered_at, read_at, created_at
		   FROM messages
		   WHERE conversation_id = $1
		     AND deleted_at IS NULL
		     AND (created_at, id) >= (
		       SELECT created_at, id
		       FROM messages
		       WHERE id = $2 AND conversation_id = $1 AND deleted_at IS NULL
		     )
		   ORDER BY created_at ASC, id ASC
		   LIMIT $3
		 ) anchored_messages
		 ORDER BY created_at DESC, id DESC`
	} else {
		query = `SELECT id, conversation_id, sender_id, message_type, content, media_url, media_public_id, delivered_at::text, read_at::text, created_at::text
			 FROM messages
			 WHERE conversation_id = $1 AND deleted_at IS NULL`
		if beforeID > 0 {
			args = append(args, beforeID)
			query += ` AND (created_at, id) < (
			    SELECT created_at, id
			    FROM messages
			    WHERE id = $2 AND conversation_id = $1 AND deleted_at IS NULL
			 )`
		}
		args = append(args, limit+1)
		query += ` ORDER BY created_at DESC, id DESC
			 LIMIT $` + strconv.Itoa(len(args))
	}

	rows, err := s.db.QueryContext(
		r.Context(),
		query,
		args...,
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
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read messages")
		return
	}
	hasMore := len(messages) > limit
	if hasMore {
		messages = messages[:limit]
	}
	if anchorID > 0 && len(messages) > 0 {
		hasMore, err = s.hasMessageBefore(r.Context(), conversationID, messages[len(messages)-1].ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not check older messages")
			return
		}
	}
	if r.URL.Query().Get("fast") != "1" {
		if err := s.hydrateMessages(r.Context(), messages, currentUserID(r), false); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load message metadata")
			return
		}
	}

	var nextBeforeID *int64
	if len(messages) > 0 {
		id := messages[len(messages)-1].ID
		nextBeforeID = &id
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"messages":       messages,
		"has_more":       hasMore,
		"next_before_id": nextBeforeID,
	})
}

func (s *Server) handleMessageReceipts(w http.ResponseWriter, r *http.Request) {
	messageID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid message id")
		return
	}

	var conversationID int64
	err = s.db.QueryRowContext(
		r.Context(),
		`SELECT conversation_id
		 FROM messages
		 WHERE id = $1 AND deleted_at IS NULL`,
		messageID,
	).Scan(&conversationID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "message not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load message")
		return
	}
	if !s.isConversationParticipant(r.Context(), conversationID, currentUserID(r)) {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}

	summary, err := s.messageReceiptSnapshot(r.Context(), messageID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load message receipts")
		return
	}
	receipts, err := s.messageReceiptDetails(r.Context(), messageID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load message receipts")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"summary":  summary,
		"receipts": receipts,
	})
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

func (s *Server) handleBusinessShareVoteSet(w http.ResponseWriter, r *http.Request) {
	messageID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid message id")
		return
	}

	var req businessShareVoteRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	vote := strings.ToLower(strings.TrimSpace(req.Vote))
	if vote != "like" && vote != "dislike" {
		writeError(w, http.StatusBadRequest, "vote must be like or dislike")
		return
	}

	var conversationID int64
	var messageType string
	err = s.db.QueryRowContext(
		r.Context(),
		`SELECT conversation_id, message_type
		 FROM messages
		 WHERE id = $1 AND deleted_at IS NULL`,
		messageID,
	).Scan(&conversationID, &messageType)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "message not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load message")
		return
	}
	if messageType != "business_share" {
		writeError(w, http.StatusBadRequest, "message is not a business share")
		return
	}
	if !s.isConversationParticipant(r.Context(), conversationID, currentUserID(r)) {
		writeError(w, http.StatusForbidden, "conversation not found")
		return
	}

	_, err = s.db.ExecContext(
		r.Context(),
		`INSERT INTO business_share_votes (message_id, user_id, vote)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (message_id, user_id)
		 DO UPDATE SET vote = EXCLUDED.vote, updated_at = CURRENT_TIMESTAMP`,
		messageID,
		currentUserID(r),
		vote,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save vote")
		return
	}

	summary, err := s.businessShareVoteSummary(r.Context(), messageID, currentUserID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load votes")
		return
	}

	memberIDs, _ := s.conversationMemberIDs(r.Context(), conversationID)
	broadcastSummary := summary
	broadcastSummary.MyVote = nil
	for _, memberID := range memberIDs {
		if memberID == currentUserID(r) {
			continue
		}
		s.chatHub.SendToUser(memberID, "business_share.vote", broadcastSummary)
	}
	writeJSON(w, http.StatusOK, summary)
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
	if req.MessageType == "business_share" && req.Content == nil {
		return messageResponse{}, errors.New("content is required for business shares")
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
	_ = s.hydrateBusinessShareVoteSummary(ctx, &message, senderID)
	return message, nil
}

func (s *Server) getConversation(ctx context.Context, conversationID int64, viewerID int64) (conversationResponse, error) {
	item, err := scanConversation(s.db.QueryRowContext(
		ctx,
		`SELECT c.id, c.user_one_id, c.user_two_id, c.conversation_type, c.title, c.avatar_url, c.avatar_public_id, c.created_by, c.created_at::text, c.updated_at::text
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
	conversations := []conversationResponse{item}
	if err := s.hydrateUnreadSummaries(ctx, conversations, viewerID); err != nil {
		return conversationResponse{}, err
	}
	item = conversations[0]
	return item, nil
}

func (s *Server) getLatestMessages(ctx context.Context, conversationIDs []int64, viewerID int64) (map[int64]messageResponse, error) {
	messagesByConversationID := make(map[int64]messageResponse)
	if len(conversationIDs) == 0 {
		return messagesByConversationID, nil
	}

	placeholders := make([]string, 0, len(conversationIDs))
	args := make([]any, 0, len(conversationIDs))
	seen := make(map[int64]struct{}, len(conversationIDs))
	for _, conversationID := range conversationIDs {
		if conversationID <= 0 {
			continue
		}
		if _, exists := seen[conversationID]; exists {
			continue
		}
		seen[conversationID] = struct{}{}
		args = append(args, conversationID)
		placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
	}
	if len(args) == 0 {
		return messagesByConversationID, nil
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT DISTINCT ON (conversation_id)
		        id, conversation_id, sender_id, message_type, content, media_url, media_public_id,
		        delivered_at::text, read_at::text, created_at::text
		 FROM messages
		 WHERE conversation_id IN (`+strings.Join(placeholders, ",")+`)
		   AND deleted_at IS NULL
		 ORDER BY conversation_id, created_at DESC, id DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]messageResponse, 0)
	for rows.Next() {
		message, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := s.hydrateMessages(ctx, messages, viewerID, true); err != nil {
		return nil, err
	}
	for _, message := range messages {
		messagesByConversationID[message.ConversationID] = message
	}

	return messagesByConversationID, nil
}

func (s *Server) hasMessageBefore(ctx context.Context, conversationID int64, beforeID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(
		ctx,
		`SELECT EXISTS (
		   SELECT 1
		   FROM messages
		   WHERE conversation_id = $1
		     AND deleted_at IS NULL
		     AND (created_at, id) < (
		       SELECT created_at, id
		       FROM messages
		       WHERE id = $2 AND conversation_id = $1 AND deleted_at IS NULL
		     )
		 )`,
		conversationID,
		beforeID,
	).Scan(&exists)
	return exists, err
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

func (s *Server) hydrateUnreadSummaries(ctx context.Context, conversations []conversationResponse, viewerID int64) error {
	if len(conversations) == 0 {
		return nil
	}

	placeholders := make([]string, 0, len(conversations))
	args := make([]any, 0, len(conversations)+1)
	seen := make(map[int64]struct{}, len(conversations))
	for _, conversation := range conversations {
		if conversation.ID <= 0 {
			continue
		}
		if _, exists := seen[conversation.ID]; exists {
			continue
		}
		seen[conversation.ID] = struct{}{}
		args = append(args, conversation.ID)
		placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
	}
	if len(args) == 0 {
		return nil
	}
	args = append(args, viewerID)
	viewerArg := "$" + strconv.Itoa(len(args))

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT mr.conversation_id,
		        COUNT(*)::int,
		        (ARRAY_AGG(mr.message_id ORDER BY m.created_at, m.id))[1]
		 FROM message_receipts mr
		 JOIN messages m ON m.id = mr.message_id
		 WHERE mr.conversation_id IN (`+strings.Join(placeholders, ",")+`)
		   AND mr.user_id = `+viewerArg+`
		   AND mr.read_at IS NULL
		   AND m.sender_id <> `+viewerArg+`
		   AND m.deleted_at IS NULL
		 GROUP BY mr.conversation_id`,
		args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type unreadSummary struct {
		count         int
		firstUnreadID int64
	}
	summaries := make(map[int64]unreadSummary)
	for rows.Next() {
		var conversationID int64
		var summary unreadSummary
		if err := rows.Scan(&conversationID, &summary.count, &summary.firstUnreadID); err != nil {
			return err
		}
		summaries[conversationID] = summary
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for index := range conversations {
		if summary, exists := summaries[conversations[index].ID]; exists {
			conversations[index].UnreadCount = summary.count
			firstUnreadID := summary.firstUnreadID
			conversations[index].FirstUnreadID = &firstUnreadID
		}
	}

	return nil
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

func (s *Server) hydrateConversations(ctx context.Context, conversations []conversationResponse, viewerID int64) error {
	if len(conversations) == 0 {
		return nil
	}

	placeholders := make([]string, 0, len(conversations))
	args := make([]any, 0, len(conversations))
	seen := make(map[int64]struct{}, len(conversations))
	for _, conversation := range conversations {
		if conversation.ID <= 0 {
			continue
		}
		if _, exists := seen[conversation.ID]; exists {
			continue
		}
		seen[conversation.ID] = struct{}{}
		args = append(args, conversation.ID)
		placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
	}
	if len(args) == 0 {
		return nil
	}

	type memberRef struct {
		userID int64
		role   string
	}
	membersByConversationID := make(map[int64][]memberRef, len(args))
	userIDs := make([]int64, 0)
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT conversation_id, user_id, role
		 FROM conversation_members
		 WHERE conversation_id IN (`+strings.Join(placeholders, ",")+`)
		   AND left_at IS NULL
		 ORDER BY conversation_id, joined_at, id`,
		args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var conversationID int64
		var member memberRef
		if err := rows.Scan(&conversationID, &member.userID, &member.role); err != nil {
			return err
		}
		membersByConversationID[conversationID] = append(membersByConversationID[conversationID], member)
		userIDs = append(userIDs, member.userID)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	usersByID, err := s.getUserResponsesByID(ctx, userIDs)
	if err != nil {
		return err
	}
	for index := range conversations {
		members := membersByConversationID[conversations[index].ID]
		conversations[index].Members = make([]userResponse, 0, len(members))
		for _, member := range members {
			user, exists := usersByID[member.userID]
			if !exists {
				continue
			}
			role := member.role
			user.Role = &role
			conversations[index].Members = append(conversations[index].Members, user)
		}
		conversations[index].MemberCount = len(conversations[index].Members)

		if conversations[index].ConversationType == "direct" && conversations[index].UserTwoID != nil {
			otherID := otherParticipant(conversations[index].UserOneID, *conversations[index].UserTwoID, viewerID)
			if otherUser, ok := usersByID[otherID]; ok {
				conversations[index].OtherUser = &otherUser
			}
		}
	}

	return nil
}

func (s *Server) ensureConversationMember(ctx context.Context, conversationID int64, userID int64, role string) error {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO conversation_members (conversation_id, user_id, role)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (conversation_id, user_id) DO UPDATE
		 SET role = EXCLUDED.role,
		     left_at = NULL,
		     joined_at = CURRENT_TIMESTAMP`,
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

func (s *Server) hydrateMessages(ctx context.Context, messages []messageResponse, viewerID int64, includeReceiptDetails bool) error {
	if len(messages) == 0 {
		return nil
	}

	messageByID := make(map[int64]*messageResponse, len(messages))
	placeholders := make([]string, 0, len(messages))
	args := make([]any, 0, len(messages))
	businessShareIDs := make([]int64, 0)
	for index := range messages {
		message := &messages[index]
		if message.ID <= 0 {
			continue
		}
		if _, exists := messageByID[message.ID]; exists {
			continue
		}
		messageByID[message.ID] = message
		args = append(args, message.ID)
		placeholders = append(placeholders, "($"+strconv.Itoa(len(args))+"::bigint)")
		if message.MessageType == "business_share" {
			businessShareIDs = append(businessShareIDs, message.ID)
		}
	}
	if len(args) == 0 {
		return nil
	}

	if err := s.hydrateMessageReceiptSnapshots(ctx, messageByID, placeholders, args); err != nil {
		return err
	}
	if includeReceiptDetails {
		if err := s.hydrateMessageReceiptDetails(ctx, messageByID, args); err != nil {
			return err
		}
	}
	if err := s.hydrateBusinessShareVoteSummaries(ctx, messageByID, businessShareIDs, viewerID); err != nil {
		return err
	}

	return nil
}

func (s *Server) hydrateMessageReceiptSnapshots(ctx context.Context, messageByID map[int64]*messageResponse, valuePlaceholders []string, args []any) error {
	rows, err := s.db.QueryContext(
		ctx,
		`WITH target_messages(id) AS (VALUES `+strings.Join(valuePlaceholders, ",")+`)
		 SELECT tm.id,
		        COUNT(mr.message_id)::int,
		        COUNT(mr.delivered_at)::int,
		        COUNT(mr.read_at)::int,
		        MAX(mr.delivered_at)::text,
		        MAX(mr.read_at)::text
		 FROM target_messages tm
		 LEFT JOIN message_receipts mr ON mr.message_id = tm.id
		 GROUP BY tm.id`,
		args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var messageID int64
		var deliveredAt, readAt sql.NullString
		var recipientCount, deliveredCount, readCount int
		if err := rows.Scan(&messageID, &recipientCount, &deliveredCount, &readCount, &deliveredAt, &readAt); err != nil {
			return err
		}
		message, ok := messageByID[messageID]
		if !ok {
			continue
		}
		message.RecipientCount = recipientCount
		message.DeliveredCount = deliveredCount
		message.ReadCount = readCount
		message.DeliveredAt = nullableString(deliveredAt)
		message.ReadAt = nullableString(readAt)
	}

	return rows.Err()
}

func (s *Server) hydrateMessageReceiptDetails(ctx context.Context, messageByID map[int64]*messageResponse, args []any) error {
	placeholders := make([]string, 0, len(args))
	for index := range args {
		placeholders = append(placeholders, "$"+strconv.Itoa(index+1))
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT message_id, user_id, delivered_at::text, read_at::text
		 FROM message_receipts
		 WHERE message_id IN (`+strings.Join(placeholders, ",")+`)
		 ORDER BY message_id, user_id`,
		args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	receiptsByMessageID := make(map[int64][]messageReceiptItem, len(messageByID))
	userIDs := make([]int64, 0)
	for rows.Next() {
		var item messageReceiptItem
		var deliveredAt, readAt sql.NullString
		if err := rows.Scan(&item.MessageID, &item.UserID, &deliveredAt, &readAt); err != nil {
			return err
		}
		item.DeliveredAt = nullableString(deliveredAt)
		item.ReadAt = nullableString(readAt)
		receiptsByMessageID[item.MessageID] = append(receiptsByMessageID[item.MessageID], item)
		userIDs = append(userIDs, item.UserID)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	usersByID, err := s.getUserResponsesByID(ctx, userIDs)
	if err != nil {
		return err
	}
	for messageID, receipts := range receiptsByMessageID {
		for index := range receipts {
			if user, exists := usersByID[receipts[index].UserID]; exists {
				receipts[index].User = &user
			}
		}
		if message, exists := messageByID[messageID]; exists {
			message.Receipts = receipts
		}
	}

	return nil
}

func (s *Server) hydrateBusinessShareVoteSummaries(ctx context.Context, messageByID map[int64]*messageResponse, messageIDs []int64, viewerID int64) error {
	if len(messageIDs) == 0 {
		return nil
	}

	placeholders := make([]string, 0, len(messageIDs))
	args := make([]any, 0, len(messageIDs)+1)
	seen := make(map[int64]struct{}, len(messageIDs))
	for _, messageID := range messageIDs {
		if _, exists := seen[messageID]; exists {
			continue
		}
		seen[messageID] = struct{}{}
		args = append(args, messageID)
		placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
	}
	viewerPlaceholder := "$" + strconv.Itoa(len(args)+1)
	args = append(args, viewerID)

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT
		   m.id,
		   COUNT(DISTINCT cm.user_id) AS participant_count,
		   COUNT(DISTINCT CASE WHEN bsv.vote = 'like' THEN bsv.user_id END) AS like_count,
		   COUNT(DISTINCT CASE WHEN bsv.vote = 'dislike' THEN bsv.user_id END) AS dislike_count,
		   MAX(CASE WHEN bsv.user_id = `+viewerPlaceholder+` THEN bsv.vote END) AS my_vote,
		   c.conversation_type
		 FROM messages m
		 JOIN conversations c ON c.id = m.conversation_id
		 JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.left_at IS NULL
		 LEFT JOIN business_share_votes bsv ON bsv.message_id = m.id
		 WHERE m.id IN (`+strings.Join(placeholders, ",")+`)
		 GROUP BY m.id, c.conversation_type`,
		args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var summary businessVoteSummary
		var conversationType string
		var myVote sql.NullString
		if err := rows.Scan(
			&summary.MessageID,
			&summary.ParticipantCount,
			&summary.LikeCount,
			&summary.DislikeCount,
			&myVote,
			&conversationType,
		); err != nil {
			return err
		}
		summary.MyVote = nullableString(myVote)
		summary.AllLiked = summary.ParticipantCount > 0 && summary.LikeCount == summary.ParticipantCount
		if summary.AllLiked {
			text := "This is the perfect choice for your group."
			if conversationType == "direct" || summary.ParticipantCount <= 2 {
				text = "This is best for both of you."
			}
			summary.RecommendationText = &text
		}
		if message, exists := messageByID[summary.MessageID]; exists {
			message.BusinessVote = &summary
		}
	}

	return rows.Err()
}

func (s *Server) hydrateBusinessShareVoteSummary(ctx context.Context, message *messageResponse, viewerID int64) error {
	if message.MessageType != "business_share" {
		return nil
	}
	summary, err := s.businessShareVoteSummary(ctx, message.ID, viewerID)
	if err != nil {
		return err
	}
	message.BusinessVote = &summary
	return nil
}

func (s *Server) businessShareVoteSummary(ctx context.Context, messageID int64, viewerID int64) (businessVoteSummary, error) {
	var summary businessVoteSummary
	var conversationType string
	var myVote sql.NullString
	err := s.db.QueryRowContext(
		ctx,
		`SELECT
		   m.id,
		   COUNT(DISTINCT cm.user_id) AS participant_count,
		   COUNT(DISTINCT CASE WHEN bsv.vote = 'like' THEN bsv.user_id END) AS like_count,
		   COUNT(DISTINCT CASE WHEN bsv.vote = 'dislike' THEN bsv.user_id END) AS dislike_count,
		   MAX(CASE WHEN bsv.user_id = $2 THEN bsv.vote END) AS my_vote,
		   c.conversation_type
		 FROM messages m
		 JOIN conversations c ON c.id = m.conversation_id
		 JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.left_at IS NULL
		 LEFT JOIN business_share_votes bsv ON bsv.message_id = m.id
		 WHERE m.id = $1
		 GROUP BY m.id, c.conversation_type`,
		messageID,
		viewerID,
	).Scan(
		&summary.MessageID,
		&summary.ParticipantCount,
		&summary.LikeCount,
		&summary.DislikeCount,
		&myVote,
		&conversationType,
	)
	if err != nil {
		return businessVoteSummary{}, err
	}
	summary.MyVote = nullableString(myVote)
	summary.AllLiked = summary.ParticipantCount > 0 && summary.LikeCount == summary.ParticipantCount
	if summary.AllLiked {
		text := "This is the perfect choice for your group."
		if conversationType == "direct" || summary.ParticipantCount <= 2 {
			text = "This is best for both of you."
		}
		summary.RecommendationText = &text
	}
	return summary, nil
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
	var title, avatarURL, avatarPublicID sql.NullString
	err := scanner.Scan(
		&item.ID,
		&item.UserOneID,
		&userTwoID,
		&item.ConversationType,
		&title,
		&avatarURL,
		&avatarPublicID,
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
	if avatarURL.Valid {
		value := avatarURL.String
		item.AvatarURL = &value
	}
	if avatarPublicID.Valid {
		value := avatarPublicID.String
		item.AvatarPublicID = &value
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

func conversationOwnerID(conversation conversationResponse) int64 {
	if conversation.CreatedBy != nil {
		return *conversation.CreatedBy
	}
	for _, member := range conversation.Members {
		if member.Role != nil && *member.Role == "owner" {
			return member.ID
		}
	}
	return 0
}

func isConversationOwner(conversation conversationResponse, userID int64) bool {
	return conversationOwnerID(conversation) == userID
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
	case "image", "video", "business_share":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "text"
	}
}

var errNotConversationParticipant = errors.New("conversation participant not found")
