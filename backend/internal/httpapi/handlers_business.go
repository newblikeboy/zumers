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

type businessSignupRequest struct {
	Email            string `json:"email"`
	Password         string `json:"password"`
	BusinessName     string `json:"business_name"`
	BusinessCategory string `json:"business_category"`
	Location         string `json:"location"`
	ContactPhone     string `json:"contact_phone"`
}

type businessLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type businessUpdateRequest struct {
	BusinessName     *string `json:"business_name"`
	BusinessCategory *string `json:"business_category"`
	Location         *string `json:"location"`
	ContactPhone     *string `json:"contact_phone"`
	Description      *string `json:"description"`
	Offerings        *string `json:"offerings"`
	OpeningHours     *string `json:"opening_hours"`
	OnboardingStatus *string `json:"onboarding_status"`
}

type businessResponse struct {
	ID               int64     `json:"id"`
	Email            string    `json:"email"`
	BusinessName     string    `json:"business_name"`
	BusinessCategory string    `json:"business_category"`
	Location         string    `json:"location"`
	ContactPhone     *string   `json:"contact_phone,omitempty"`
	Description      *string   `json:"description,omitempty"`
	Offerings        *string   `json:"offerings,omitempty"`
	OpeningHours     *string   `json:"opening_hours,omitempty"`
	OnboardingStatus string    `json:"onboarding_status"`
	AccountStatus    string    `json:"account_status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type businessAuthResponse struct {
	AccessToken          string           `json:"access_token"`
	AccessTokenExpiresAt time.Time        `json:"access_token_expires_at"`
	Business             businessResponse `json:"business"`
}

func (s *Server) handleBusinessSignup(w http.ResponseWriter, r *http.Request) {
	var req businessSignupRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	normalizeBusinessSignup(&req)
	if err := validateBusinessSignup(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	passwordHash, err := security.HashPassword(req.Password)
	if err != nil {
		s.logger.Error("business password hash failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not create business account")
		return
	}

	var businessID int64
	err = s.db.QueryRowContext(
		r.Context(),
		`INSERT INTO business_accounts (email, password_hash, business_name, business_category, location, contact_phone)
		 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))
		 RETURNING id`,
		req.Email,
		passwordHash,
		req.BusinessName,
		req.BusinessCategory,
		req.Location,
		req.ContactPhone,
	).Scan(&businessID)
	if err != nil {
		writeError(w, http.StatusConflict, "business email is already registered")
		return
	}

	response, err := s.issueBusinessAuthResponse(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create business session")
		return
	}

	writeJSON(w, http.StatusCreated, response)
}

func (s *Server) handleBusinessLogin(w http.ResponseWriter, r *http.Request) {
	var req businessLoginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	var businessID int64
	var passwordHash string
	err := s.db.QueryRowContext(
		r.Context(),
		`SELECT id, password_hash
		 FROM business_accounts
		 WHERE email = $1 AND account_status = 'active'`,
		email,
	).Scan(&businessID, &passwordHash)
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

	response, err := s.issueBusinessAuthResponse(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create business session")
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleBusinessMe(w http.ResponseWriter, r *http.Request) {
	business, err := s.getBusinessResponse(r.Context(), currentBusinessID(r))
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "business account not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business account")
		return
	}

	writeJSON(w, http.StatusOK, business)
}

func (s *Server) handleBusinessUpdate(w http.ResponseWriter, r *http.Request) {
	var req businessUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	status := strings.TrimSpace(valueOrEmpty(req.OnboardingStatus))
	if status != "" && status != "draft" && status != "submitted" {
		writeError(w, http.StatusBadRequest, "invalid onboarding status")
		return
	}

	_, err := s.db.ExecContext(
		r.Context(),
		`UPDATE business_accounts
		 SET business_name = COALESCE(NULLIF($2, ''), business_name),
		     business_category = COALESCE(NULLIF($3, ''), business_category),
		     location = COALESCE(NULLIF($4, ''), location),
		     contact_phone = NULLIF($5, ''),
		     description = NULLIF($6, ''),
		     offerings = NULLIF($7, ''),
		     opening_hours = NULLIF($8, ''),
		     onboarding_status = COALESCE(NULLIF($9, ''), onboarding_status),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND account_status = 'active'`,
		currentBusinessID(r),
		strings.TrimSpace(valueOrEmpty(req.BusinessName)),
		strings.TrimSpace(valueOrEmpty(req.BusinessCategory)),
		strings.TrimSpace(valueOrEmpty(req.Location)),
		strings.TrimSpace(valueOrEmpty(req.ContactPhone)),
		strings.TrimSpace(valueOrEmpty(req.Description)),
		strings.TrimSpace(valueOrEmpty(req.Offerings)),
		strings.TrimSpace(valueOrEmpty(req.OpeningHours)),
		status,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update business onboarding")
		return
	}

	business, err := s.getBusinessResponse(r.Context(), currentBusinessID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business account")
		return
	}

	writeJSON(w, http.StatusOK, business)
}

func (s *Server) issueBusinessAuthResponse(ctx context.Context, businessID int64) (businessAuthResponse, error) {
	accessToken, accessExpiresAt, err := s.tokens.IssueBusinessAccessToken(businessID)
	if err != nil {
		return businessAuthResponse{}, err
	}

	business, err := s.getBusinessResponse(ctx, businessID)
	if err != nil {
		return businessAuthResponse{}, err
	}

	return businessAuthResponse{
		AccessToken:          accessToken,
		AccessTokenExpiresAt: accessExpiresAt,
		Business:             business,
	}, nil
}

func (s *Server) getBusinessResponse(ctx context.Context, businessID int64) (businessResponse, error) {
	var business businessResponse
	var contactPhone, description, offerings, openingHours sql.NullString
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, email, business_name, business_category, location, contact_phone, description,
		        offerings, opening_hours, onboarding_status, account_status, created_at, updated_at
		 FROM business_accounts
		 WHERE id = $1`,
		businessID,
	).Scan(
		&business.ID,
		&business.Email,
		&business.BusinessName,
		&business.BusinessCategory,
		&business.Location,
		&contactPhone,
		&description,
		&offerings,
		&openingHours,
		&business.OnboardingStatus,
		&business.AccountStatus,
		&business.CreatedAt,
		&business.UpdatedAt,
	)
	if err != nil {
		return businessResponse{}, err
	}

	business.ContactPhone = nullableString(contactPhone)
	business.Description = nullableString(description)
	business.Offerings = nullableString(offerings)
	business.OpeningHours = nullableString(openingHours)
	return business, nil
}

func normalizeBusinessSignup(req *businessSignupRequest) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.BusinessName = strings.TrimSpace(req.BusinessName)
	req.BusinessCategory = strings.TrimSpace(req.BusinessCategory)
	req.Location = strings.TrimSpace(req.Location)
	req.ContactPhone = strings.TrimSpace(req.ContactPhone)
}

func validateBusinessSignup(req businessSignupRequest) error {
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return errors.New("valid business email is required")
	}
	if len(req.Password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	if req.BusinessName == "" {
		return errors.New("business name is required")
	}
	if req.BusinessCategory == "" {
		return errors.New("business category is required")
	}
	if req.Location == "" {
		return errors.New("location is required")
	}

	return nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}
