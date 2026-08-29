package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
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

type wsTicketStore struct {
	mu      sync.Mutex
	tickets map[[32]byte]wsTicket
	ttl     time.Duration
}

type wsTicket struct {
	userID    int64
	expiresAt time.Time
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

func newWSTicketStore() *wsTicketStore {
	store := &wsTicketStore{
		tickets: make(map[[32]byte]wsTicket),
		ttl:     time.Minute,
	}
	go store.cleanup()
	return store
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
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
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
		writeError(w, http.StatusUnauthorized, "invalid websocket ticket")
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
	conn.SetWriteDeadline(time.Time{})

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

			s.deliverMessageToConversation(r.Context(), message)
			_ = s.hydrateMessageReceiptCounts(r.Context(), &message)
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

			memberIDs, _ := s.conversationMemberIDs(r.Context(), event.ConversationID)
			for _, memberID := range memberIDs {
				s.chatHub.SendToUser(memberID, "conversation.read", receipt)
			}
		default:
			_ = conn.WriteJSON(webSocketEvent{Type: "error", Data: map[string]string{"message": "unknown event type"}})
		}
	}
}

func (s *Server) authenticateWebSocket(r *http.Request) (int64, error) {
	ticket := strings.TrimSpace(r.URL.Query().Get("ticket"))
	return s.wsTickets.Consume(ticket)
}

type wsTicketResponse struct {
	Ticket    string    `json:"ticket"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (s *Server) handleChatTicket(w http.ResponseWriter, r *http.Request) {
	ticket, expiresAt, err := s.wsTickets.Issue(currentUserID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create websocket ticket")
		return
	}

	writeJSON(w, http.StatusCreated, wsTicketResponse{
		Ticket:    ticket,
		ExpiresAt: expiresAt,
	})
}

func (s *wsTicketStore) Issue(userID int64) (string, time.Time, error) {
	if userID <= 0 {
		return "", time.Time{}, errInvalidWSTicket
	}

	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", time.Time{}, err
	}

	ticket := base64.RawURLEncoding.EncodeToString(bytes)
	expiresAt := time.Now().Add(s.ttl)
	s.mu.Lock()
	s.tickets[hashWSTicket(ticket)] = wsTicket{
		userID:    userID,
		expiresAt: expiresAt,
	}
	s.mu.Unlock()

	return ticket, expiresAt, nil
}

func (s *wsTicketStore) Consume(ticket string) (int64, error) {
	if strings.TrimSpace(ticket) == "" {
		return 0, errInvalidWSTicket
	}

	key := hashWSTicket(ticket)
	now := time.Now()

	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.tickets[key]
	if !ok {
		return 0, errInvalidWSTicket
	}
	delete(s.tickets, key)
	if now.After(item.expiresAt) {
		return 0, errInvalidWSTicket
	}

	return item.userID, nil
}

func (s *wsTicketStore) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		s.mu.Lock()
		for key, item := range s.tickets {
			if now.After(item.expiresAt) {
				delete(s.tickets, key)
			}
		}
		s.mu.Unlock()
	}
}

func hashWSTicket(ticket string) [32]byte {
	return sha256.Sum256([]byte(ticket))
}

var errInvalidWSTicket = errors.New("invalid websocket ticket")
