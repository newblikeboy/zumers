package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"zumers/backend/internal/config"
)

const (
	AccessTokenType         = "access"
	RefreshTokenType        = "refresh"
	BusinessAccessTokenType = "business_access"
)

type TokenManager struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

type Claims struct {
	TokenType string `json:"typ"`
	jwt.RegisteredClaims
}

func NewTokenManager(cfg config.Config) (*TokenManager, error) {
	accessSecret := cfg.JWT.AccessSecret
	refreshSecret := cfg.JWT.RefreshSecret
	if cfg.AppEnv != "production" {
		if accessSecret == "" {
			accessSecret = "dev-only-access-secret-change-before-production"
		}
		if refreshSecret == "" {
			refreshSecret = "dev-only-refresh-secret-change-before-production"
		}
	}
	if accessSecret == "" || refreshSecret == "" {
		return nil, errors.New("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required")
	}

	accessMinutes, err := strconv.Atoi(cfg.JWT.AccessTTLMinutes)
	if err != nil || accessMinutes <= 0 {
		return nil, errors.New("JWT_ACCESS_TTL_MINUTES must be a positive integer")
	}

	refreshDays, err := strconv.Atoi(cfg.JWT.RefreshTTLDays)
	if err != nil || refreshDays <= 0 {
		return nil, errors.New("JWT_REFRESH_TTL_DAYS must be a positive integer")
	}

	return &TokenManager{
		accessSecret:  []byte(accessSecret),
		refreshSecret: []byte(refreshSecret),
		accessTTL:     time.Duration(accessMinutes) * time.Minute,
		refreshTTL:    time.Duration(refreshDays) * 24 * time.Hour,
	}, nil
}

func (m *TokenManager) AccessTTL() time.Duration {
	return m.accessTTL
}

func (m *TokenManager) RefreshTTL() time.Duration {
	return m.refreshTTL
}

func (m *TokenManager) IssueAccessToken(userID int64) (string, time.Time, error) {
	return m.issueAccessToken(userID, AccessTokenType)
}

func (m *TokenManager) IssueBusinessAccessToken(businessID int64) (string, time.Time, error) {
	return m.issueAccessToken(businessID, BusinessAccessTokenType)
}

func (m *TokenManager) issueAccessToken(subjectID int64, tokenType string) (string, time.Time, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(m.accessTTL)
	claims := Claims{
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(subjectID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.accessSecret)
	return token, expiresAt, err
}

func (m *TokenManager) ParseAccessToken(tokenValue string) (int64, error) {
	return m.parseAccessToken(tokenValue, AccessTokenType)
}

func (m *TokenManager) ParseBusinessAccessToken(tokenValue string) (int64, error) {
	return m.parseAccessToken(tokenValue, BusinessAccessTokenType)
}

func (m *TokenManager) parseAccessToken(tokenValue string, tokenType string) (int64, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenValue, claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method %s", token.Header["alg"])
		}

		return m.accessSecret, nil
	})
	if err != nil {
		return 0, err
	}
	if !token.Valid || claims.TokenType != tokenType {
		return 0, errors.New("invalid access token")
	}

	subjectID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || subjectID <= 0 {
		return 0, errors.New("invalid token subject")
	}

	return subjectID, nil
}

func GenerateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
