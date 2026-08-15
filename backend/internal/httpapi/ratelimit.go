package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type rateLimiterStore struct {
	mu       sync.Mutex
	limiters map[string]*clientLimiter
}

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newRateLimiterStore() *rateLimiterStore {
	store := &rateLimiterStore{
		limiters: make(map[string]*clientLimiter),
	}
	go store.cleanup()
	return store
}

func (s *Server) withRateLimit(name string, requestsPerMinute int, burst int, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := name + ":" + clientIP(r)
		limiter := s.rateLimiters.get(key, requestsPerMinute, burst)
		if !limiter.Allow() {
			writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
			return
		}

		handler(w, r)
	}
}

func (s *rateLimiterStore) get(key string, requestsPerMinute int, burst int) *rate.Limiter {
	s.mu.Lock()
	defer s.mu.Unlock()

	if item, ok := s.limiters[key]; ok {
		item.lastSeen = time.Now()
		return item.limiter
	}

	limiter := rate.NewLimiter(rate.Every(time.Minute/time.Duration(requestsPerMinute)), burst)
	s.limiters[key] = &clientLimiter{limiter: limiter, lastSeen: time.Now()}
	return limiter
}

func (s *rateLimiterStore) cleanup() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		for key, item := range s.limiters {
			if time.Since(item.lastSeen) > 30*time.Minute {
				delete(s.limiters, key)
			}
		}
		s.mu.Unlock()
	}
}

func clientIP(r *http.Request) string {
	forwardedFor := r.Header.Get("X-Forwarded-For")
	if forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}

	return r.RemoteAddr
}
