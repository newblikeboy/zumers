package httpapi

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"zumers/backend/internal/config"
	"zumers/backend/internal/security"
)

type Server struct {
	cfg          config.Config
	db           *sql.DB
	tokens       *security.TokenManager
	logger       *slog.Logger
	mux          *http.ServeMux
	chatHub      *ChatHub
	rateLimiters *rateLimiterStore
}

func NewServer(cfg config.Config, db *sql.DB, logger *slog.Logger) (http.Handler, error) {
	tokens, err := security.NewTokenManager(cfg)
	if err != nil {
		return nil, err
	}

	server := &Server{
		cfg:          cfg,
		db:           db,
		tokens:       tokens,
		logger:       logger,
		mux:          http.NewServeMux(),
		chatHub:      NewChatHub(),
		rateLimiters: newRateLimiterStore(),
	}

	server.routes()

	return server.withLogging(server.withCORS(server.mux)), nil
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", s.handleHealth)
	s.mux.HandleFunc("GET /api/v1/health", s.handleHealth)

	s.mux.HandleFunc("POST /api/v1/auth/signup", s.withRateLimit("auth", 10, 5, s.handleSignup))
	s.mux.HandleFunc("POST /api/v1/auth/login", s.withRateLimit("auth", 20, 5, s.handleLogin))
	s.mux.HandleFunc("POST /api/v1/auth/refresh", s.handleRefresh)
	s.mux.HandleFunc("POST /api/v1/auth/logout", s.withAuth(s.handleLogout))
	s.mux.HandleFunc("GET /api/v1/me", s.withAuth(s.handleMe))

	s.mux.HandleFunc("POST /api/v1/business/signup", s.withRateLimit("business-auth", 10, 5, s.handleBusinessSignup))
	s.mux.HandleFunc("POST /api/v1/business/login", s.withRateLimit("business-auth", 20, 5, s.handleBusinessLogin))
	s.mux.HandleFunc("GET /api/v1/business/taxonomy", s.handleBusinessTaxonomy)
	s.mux.HandleFunc("GET /api/v1/business/me", s.withBusinessAuth(s.handleBusinessMe))
	s.mux.HandleFunc("PATCH /api/v1/business/me", s.withBusinessAuth(s.handleBusinessUpdate))
	s.mux.HandleFunc("GET /api/v1/business/dashboard", s.withBusinessAuth(s.handleBusinessDashboard))
	s.mux.HandleFunc("PATCH /api/v1/business/dashboard", s.withBusinessAuth(s.handleBusinessDashboardUpdate))

	s.mux.HandleFunc("GET /api/v1/users/search", s.withAuth(s.handleUserSearch))
	s.mux.HandleFunc("GET /api/v1/users/{id}", s.withAuth(s.handleProfileView))
	s.mux.HandleFunc("PATCH /api/v1/me/profile", s.withAuth(s.handleProfileUpdate))

	s.mux.HandleFunc("POST /api/v1/friends/requests", s.withAuth(s.handleFriendRequestCreate))
	s.mux.HandleFunc("GET /api/v1/friends/requests", s.withAuth(s.handleFriendRequestsList))
	s.mux.HandleFunc("POST /api/v1/friends/requests/{id}/accept", s.withAuth(s.handleFriendRequestAccept))
	s.mux.HandleFunc("POST /api/v1/friends/requests/{id}/reject", s.withAuth(s.handleFriendRequestReject))
	s.mux.HandleFunc("GET /api/v1/friends", s.withAuth(s.handleFriendsList))
	s.mux.HandleFunc("GET /api/v1/friends/suggestions", s.withAuth(s.handleFriendSuggestions))
	s.mux.HandleFunc("DELETE /api/v1/friends/{id}", s.withAuth(s.handleUnfriend))

	s.mux.HandleFunc("POST /api/v1/posts", s.withAuth(s.withRateLimit("posts", 30, 10, s.handlePostCreate)))
	s.mux.HandleFunc("GET /api/v1/feed", s.withAuth(s.handleFeed))
	s.mux.HandleFunc("GET /api/v1/reels", s.withAuth(s.handleReels))
	s.mux.HandleFunc("GET /api/v1/users/{id}/posts", s.withAuth(s.handleUserPosts))
	s.mux.HandleFunc("PATCH /api/v1/posts/{id}", s.withAuth(s.handlePostUpdate))
	s.mux.HandleFunc("DELETE /api/v1/posts/{id}", s.withAuth(s.handlePostDelete))
	s.mux.HandleFunc("POST /api/v1/posts/{id}/reactions", s.withAuth(s.handlePostReactionSet))
	s.mux.HandleFunc("DELETE /api/v1/posts/{id}/reactions", s.withAuth(s.handlePostReactionDelete))
	s.mux.HandleFunc("GET /api/v1/posts/{id}/comments", s.withAuth(s.handlePostCommentsList))
	s.mux.HandleFunc("POST /api/v1/posts/{id}/comments", s.withAuth(s.handlePostCommentCreate))
	s.mux.HandleFunc("DELETE /api/v1/comments/{id}", s.withAuth(s.handleCommentDelete))
	s.mux.HandleFunc("POST /api/v1/posts/{id}/share", s.withAuth(s.handlePostShare))

	s.mux.HandleFunc("POST /api/v1/media/sign-upload", s.withAuth(s.withRateLimit("uploads", 20, 5, s.handleCloudinarySignUpload)))

	s.mux.HandleFunc("GET /api/v1/conversations", s.withAuth(s.handleConversationsList))
	s.mux.HandleFunc("POST /api/v1/conversations", s.withAuth(s.handleConversationCreate))
	s.mux.HandleFunc("GET /api/v1/conversations/{id}/messages", s.withAuth(s.handleMessageHistory))
	s.mux.HandleFunc("POST /api/v1/conversations/{id}/messages", s.withAuth(s.withRateLimit("messages", 60, 20, s.handleMessageCreate)))
	s.mux.HandleFunc("POST /api/v1/conversations/{id}/read", s.withAuth(s.handleConversationRead))
	s.mux.HandleFunc("GET /api/v1/notifications", s.withAuth(s.handleNotificationsList))
	s.mux.HandleFunc("POST /api/v1/notifications/{id}/read", s.withAuth(s.handleNotificationRead))
	s.mux.HandleFunc("GET /ws/chat", s.withRateLimit("ws", 30, 5, s.handleChatWebSocket))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"env":    s.cfg.AppEnv,
	})
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && origin == s.cfg.FrontendURL {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		s.logger.Info("request completed", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(start).Milliseconds())
	})
}
