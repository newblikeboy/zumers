package httpapi

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type ChatHub struct {
	mu          sync.Mutex
	connections map[int64]map[*websocket.Conn]struct{}
}

type webSocketEvent struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

type inboundChatEvent struct {
	Type           string  `json:"type"`
	ConversationID int64   `json:"conversation_id"`
	MessageType    string  `json:"message_type"`
	Content        *string `json:"content"`
	MediaURL       *string `json:"media_url"`
	MediaPublicID  *string `json:"media_public_id"`
}

func NewChatHub() *ChatHub {
	return &ChatHub{
		connections: make(map[int64]map[*websocket.Conn]struct{}),
	}
}

func (h *ChatHub) Register(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.connections[userID] == nil {
		h.connections[userID] = make(map[*websocket.Conn]struct{})
	}
	h.connections[userID][conn] = struct{}{}
}

func (h *ChatHub) Unregister(userID int64, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.connections[userID], conn)
	if len(h.connections[userID]) == 0 {
		delete(h.connections, userID)
	}
}

func (h *ChatHub) SendToUser(userID int64, eventType string, payload any) int {
	h.mu.Lock()
	defer h.mu.Unlock()

	sent := 0
	for conn := range h.connections[userID] {
		if err := conn.WriteJSON(webSocketEvent{Type: eventType, Data: payload}); err != nil {
			conn.Close()
			delete(h.connections[userID], conn)
			continue
		}
		sent++
	}

	return sent
}

func (s *Server) handleChatWebSocket(w http.ResponseWriter, r *http.Request) {
	userID, err := s.authenticateWebSocket(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid access token")
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			return origin == "" || origin == s.cfg.FrontendURL
		},
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	s.chatHub.Register(userID, conn)
	defer s.chatHub.Unregister(userID, conn)

	conn.SetReadLimit(8192)
	conn.SetReadDeadline(time.Time{})

	for {
		var event inboundChatEvent
		if err := conn.ReadJSON(&event); err != nil {
			return
		}

		switch event.Type {
		case "message.send":
			message, err := s.createMessage(r.Context(), userID, event.ConversationID, messageCreateRequest{
				MessageType:   event.MessageType,
				Content:       event.Content,
				MediaURL:      event.MediaURL,
				MediaPublicID: event.MediaPublicID,
			})
			if err != nil {
				_ = conn.WriteJSON(webSocketEvent{Type: "error", Data: map[string]string{"message": err.Error()}})
				continue
			}

			recipientID, _ := s.conversationRecipient(r.Context(), event.ConversationID, userID)
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
					s.chatHub.SendToUser(userID, "message.delivered", receipt)
					s.chatHub.SendToUser(recipientID, "message.delivered", receipt)
				}
			}
			s.chatHub.SendToUser(userID, "message.created", message)
		case "conversation.read":
			if event.ConversationID <= 0 || !s.isConversationParticipant(r.Context(), event.ConversationID, userID) {
				_ = conn.WriteJSON(webSocketEvent{Type: "error", Data: map[string]string{"message": "conversation not found"}})
				continue
			}

			receipt, err := s.markConversationRead(r.Context(), event.ConversationID, userID)
			if err != nil {
				_ = conn.WriteJSON(webSocketEvent{Type: "error", Data: map[string]string{"message": "could not mark conversation read"}})
				continue
			}

			senderID, _ := s.conversationRecipient(r.Context(), event.ConversationID, userID)
			s.chatHub.SendToUser(senderID, "conversation.read", receipt)
			s.chatHub.SendToUser(userID, "conversation.read", receipt)
		default:
			_ = conn.WriteJSON(webSocketEvent{Type: "error", Data: map[string]string{"message": "unknown event type"}})
		}
	}
}

func (s *Server) authenticateWebSocket(r *http.Request) (int64, error) {
	tokenValue := strings.TrimSpace(r.URL.Query().Get("access_token"))
	if tokenValue == "" {
		tokenValue = strings.TrimSpace(r.URL.Query().Get("token"))
	}

	return s.tokens.ParseAccessToken(tokenValue)
}
