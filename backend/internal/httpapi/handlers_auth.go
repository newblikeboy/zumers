package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"zumers/backend/internal/security"
)

type signupRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DateOfBirth string `json:"date_of_birth"`
	DisplayName string `json:"display_name"`
	Username    string `json:"username"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type authResponse struct {
	AccessToken           string       `json:"access_token"`
	AccessTokenExpiresAt  time.Time    `json:"access_token_expires_at"`
	RefreshToken          string       `json:"refresh_token"`
	RefreshTokenExpiresAt time.Time    `json:"refresh_token_expires_at"`
	User                  userResponse `json:"user"`
}

type userResponse struct {
	ID                int64     `json:"id"`
	Email             string    `json:"email"`
	DateOfBirth       string    `json:"date_of_birth"`
	AccountStatus     string    `json:"account_status"`
	DisplayName       string    `json:"display_name"`
	Username          string    `json:"username"`
	Role              *string   `json:"role,omitempty"`
	Bio               *string   `json:"bio,omitempty"`
	Location          *string   `json:"location,omitempty"`
	AvatarURL         *string   `json:"avatar_url,omitempty"`
	AvatarPublicID    *string   `json:"avatar_public_id,omitempty"`
	CoverURL          *string   `json:"cover_url,omitempty"`
	CoverPublicID     *string   `json:"cover_public_id,omitempty"`
	ProfileVisibility string    `json:"profile_visibility"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Username = strings.ToLower(strings.TrimSpace(req.Username))
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if err := validateSignup(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		writeError(w, http.StatusBadRequest, "date_of_birth must use YYYY-MM-DD")
		return
	}
	if !isAtLeast18(dob, time.Now().UTC()) {
		writeError(w, http.StatusBadRequest, "user must be at least 18 years old")
		return
	}

	passwordHash, err := security.HashPassword(req.Password)
	if err != nil {
		s.logger.Error("password hash failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	defer tx.Rollback()

	var userID int64
	err = tx.QueryRowContext(
		r.Context(),
		`INSERT INTO users (email, password_hash, date_of_birth)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		req.Email,
		passwordHash,
		dob,
	).Scan(&userID)
	if err != nil {
		writeError(w, http.StatusConflict, "email is already registered")
		return
	}

	_, err = tx.ExecContext(
		r.Context(),
		`INSERT INTO profiles (user_id, display_name, username)
		 VALUES ($1, $2, $3)`,
		userID,
		req.DisplayName,
		req.Username,
	)
	if err != nil {
		writeError(w, http.StatusConflict, "username is already taken")
		return
	}

	response, err := s.issueAuthResponse(r.Context(), tx, userID)
	if err != nil {
		s.logger.Error("issue signup tokens failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	writeJSON(w, http.StatusCreated, response)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	var userID int64
	var passwordHash string
	err := s.db.QueryRowContext(
		r.Context(),
		`SELECT id, password_hash
		 FROM users
		 WHERE email = $1 AND account_status = 'active'`,
		email,
	).Scan(&userID, &passwordHash)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not log in")
		return
	}
	if !security.CheckPassword(req.Password, passwordHash) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not log in")
		return
	}
	defer tx.Rollback()

	response, err := s.issueAuthResponse(r.Context(), tx, userID)
	if err != nil {
		s.logger.Error("issue login tokens failed", "error", err, "user_id", userID)
		writeError(w, http.StatusInternalServerError, "could not create session")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not log in")
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := decodeJSON(r, &req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	tokenHash := security.HashToken(req.RefreshToken)
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not refresh session")
		return
	}
	defer tx.Rollback()

	var userID int64
	err = tx.QueryRowContext(
		r.Context(),
		`SELECT user_id
		 FROM refresh_tokens
		 WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
		tokenHash,
	).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not refresh session")
		return
	}

	_, err = tx.ExecContext(r.Context(), `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1`, tokenHash)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not refresh session")
		return
	}

	response, err := s.issueAuthResponse(r.Context(), tx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not refresh session")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not refresh session")
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := decodeJSON(r, &req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	_, err := s.db.ExecContext(
		r.Context(),
		`UPDATE refresh_tokens
		 SET revoked_at = CURRENT_TIMESTAMP
		 WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
		security.HashToken(req.RefreshToken),
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not log out")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, err := s.getUserResponse(r.Context(), currentUserID(r))
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load user")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (s *Server) issueAuthResponse(ctx context.Context, tx *sql.Tx, userID int64) (authResponse, error) {
	accessToken, accessExpiresAt, err := s.tokens.IssueAccessToken(userID)
	if err != nil {
		return authResponse{}, err
	}

	refreshToken, err := security.GenerateRefreshToken()
	if err != nil {
		return authResponse{}, err
	}
	refreshExpiresAt := time.Now().UTC().Add(s.tokens.RefreshTTL())

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
		 VALUES ($1, $2, $3)`,
		security.HashToken(refreshToken),
		userID,
		refreshExpiresAt,
	)
	if err != nil {
		return authResponse{}, err
	}

	user, err := s.getUserResponseWith(ctx, tx, userID)
	if err != nil {
		return authResponse{}, err
	}

	return authResponse{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessExpiresAt,
		RefreshToken:          refreshToken,
		RefreshTokenExpiresAt: refreshExpiresAt,
		User:                  user,
	}, nil
}

func validateSignup(req signupRequest) error {
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return errors.New("valid email is required")
	}
	if len(req.Password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if req.DateOfBirth == "" {
		return errors.New("date_of_birth is required")
	}
	if req.DisplayName == "" {
		return errors.New("display_name is required")
	}
	if len(req.Username) < 3 {
		return errors.New("username must be at least 3 characters")
	}

	return nil
}

func isAtLeast18(dob time.Time, now time.Time) bool {
	eighteenthBirthday := dob.AddDate(18, 0, 0)
	return !eighteenthBirthday.After(now)
}
