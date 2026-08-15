package httpapi

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userIDContextKey contextKey = "userID"

func (s *Server) withAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" {
			writeError(w, http.StatusUnauthorized, "authorization header is required")
			return
		}

		tokenValue, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || strings.TrimSpace(tokenValue) == "" {
			writeError(w, http.StatusUnauthorized, "bearer token is required")
			return
		}

		userID, err := s.tokens.ParseAccessToken(tokenValue)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid access token")
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, userID)
		handler(w, r.WithContext(ctx))
	}
}

func currentUserID(r *http.Request) int64 {
	return currentUserIDFromContext(r.Context())
}

func currentUserIDFromContext(ctx context.Context) int64 {
	userID, _ := ctx.Value(userIDContextKey).(int64)
	return userID
}
