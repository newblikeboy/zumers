package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"zumers/backend/internal/security"
)

type businessSignupRequest struct {
	Email               string   `json:"email"`
	Password            string   `json:"password"`
	BusinessName        string   `json:"business_name"`
	BusinessCategory    string   `json:"business_category"`
	BusinessSubcategory string   `json:"business_subcategory"`
	Location            string   `json:"location"`
	Address             string   `json:"address"`
	City                string   `json:"city"`
	Area                string   `json:"area"`
	PostalCode          string   `json:"postal_code"`
	GooglePlaceID       string   `json:"google_place_id"`
	State               string   `json:"state"`
	Country             string   `json:"country"`
	District            string   `json:"district"`
	Landmark            string   `json:"landmark"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	LocationAccuracy    *float64 `json:"location_accuracy_meters"`
	ContactPhone        string   `json:"contact_phone"`
}

type businessLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type businessDuplicateCheckRequest struct {
	BusinessName  string `json:"business_name"`
	Location      string `json:"location"`
	City          string `json:"city"`
	Area          string `json:"area"`
	GooglePlaceID string `json:"google_place_id"`
}

type businessDuplicateCheckResponse struct {
	Matches    []businessDuplicateMatch `json:"matches"`
	ExactMatch bool                     `json:"exact_match"`
}

type businessDuplicateMatch struct {
	BusinessID        int64   `json:"business_id"`
	BusinessName      string  `json:"business_name"`
	BusinessCategory  string  `json:"business_category"`
	Location          string  `json:"location"`
	City              *string `json:"city,omitempty"`
	Area              *string `json:"area,omitempty"`
	GooglePlaceID     *string `json:"google_place_id,omitempty"`
	VerificationLevel string  `json:"verification_level"`
	MatchType         string  `json:"match_type"`
	ClaimAvailable    bool    `json:"claim_available"`
}

type businessClaimRequestCreate struct {
	ExistingBusinessID int64  `json:"existing_business_id"`
	ClaimantName       string `json:"claimant_name"`
	ClaimantPhone      string `json:"claimant_phone"`
	ClaimantNote       string `json:"claimant_note"`
	EvidenceURL        string `json:"evidence_url"`
	MatchSource        string `json:"match_source"`
}

type businessClaimRequestResponse struct {
	ID                 int64      `json:"id"`
	ExistingBusinessID int64      `json:"existing_business_id"`
	ClaimantBusinessID int64      `json:"claimant_business_id"`
	ClaimantName       *string    `json:"claimant_name,omitempty"`
	ClaimantPhone      *string    `json:"claimant_phone,omitempty"`
	ClaimantNote       *string    `json:"claimant_note,omitempty"`
	EvidenceURL        *string    `json:"evidence_url,omitempty"`
	MatchSource        string     `json:"match_source"`
	Status             string     `json:"status"`
	ReviewedAt         *time.Time `json:"reviewed_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type businessUpdateRequest struct {
	BusinessName         *string                          `json:"business_name"`
	BusinessCategory     *string                          `json:"business_category"`
	BusinessSubcategory  *string                          `json:"business_subcategory"`
	Location             *string                          `json:"location"`
	Address              *string                          `json:"address"`
	City                 *string                          `json:"city"`
	Area                 *string                          `json:"area"`
	PostalCode           *string                          `json:"postal_code"`
	GooglePlaceID        *string                          `json:"google_place_id"`
	State                *string                          `json:"state"`
	Country              *string                          `json:"country"`
	District             *string                          `json:"district"`
	Landmark             *string                          `json:"landmark"`
	Latitude             *float64                         `json:"latitude"`
	Longitude            *float64                         `json:"longitude"`
	LocationAccuracy     *float64                         `json:"location_accuracy_meters"`
	ServiceRadiusKM      *float64                         `json:"service_radius_km"`
	PriceRange           *string                          `json:"price_range"`
	MoodTags             *string                          `json:"mood_tags"`
	ServiceTags          *string                          `json:"service_tags"`
	BestFor              *string                          `json:"best_for"`
	FacilityTags         *string                          `json:"facility_tags"`
	WebsiteURL           *string                          `json:"website_url"`
	WhatsappNumber       *string                          `json:"whatsapp_number"`
	ContactPhone         *string                          `json:"contact_phone"`
	Description          *string                          `json:"description"`
	Offerings            *string                          `json:"offerings"`
	OpeningHours         *string                          `json:"opening_hours"`
	OpeningHoursSchedule []businessOpeningHourRequest     `json:"opening_hours_schedule"`
	VenueExperiences     []businessVenueExperienceRequest `json:"venue_experiences"`
	BusinessMedia        []businessMediaRequest           `json:"business_media"`
	VenueMedia           []businessMediaRequest           `json:"venue_media"`
	OnboardingStatus     *string                          `json:"onboarding_status"`
}

type businessMediaRequest struct {
	MediaType          string  `json:"media_type"`
	Purpose            string  `json:"purpose"`
	CloudinaryPublicID string  `json:"cloudinary_public_id"`
	SecureURL          string  `json:"secure_url"`
	ThumbnailURL       *string `json:"thumbnail_url,omitempty"`
	Width              *int    `json:"width,omitempty"`
	Height             *int    `json:"height,omitempty"`
	DurationSeconds    *int    `json:"duration_seconds,omitempty"`
	AltText            *string `json:"alt_text,omitempty"`
	DisplayOrder       int     `json:"display_order"`
	Status             *string `json:"status,omitempty"`
}

type businessMediaResponse struct {
	ID                 int64   `json:"id"`
	MediaType          string  `json:"media_type"`
	Purpose            string  `json:"purpose"`
	CloudinaryPublicID string  `json:"cloudinary_public_id"`
	SecureURL          string  `json:"secure_url"`
	ThumbnailURL       *string `json:"thumbnail_url,omitempty"`
	Width              *int    `json:"width,omitempty"`
	Height             *int    `json:"height,omitempty"`
	DurationSeconds    *int    `json:"duration_seconds,omitempty"`
	AltText            *string `json:"alt_text,omitempty"`
	DisplayOrder       int     `json:"display_order"`
	Status             string  `json:"status"`
}

type businessVenueExperienceRequest struct {
	ExperienceName         string                 `json:"experience_name"`
	Description            *string                `json:"description,omitempty"`
	Category               *string                `json:"category,omitempty"`
	Tags                   *string                `json:"tags,omitempty"`
	StartingPrice          *float64               `json:"starting_price,omitempty"`
	AveragePricePerPerson  *float64               `json:"average_price_per_person,omitempty"`
	TypicalDurationMinutes *int                   `json:"typical_duration_minutes,omitempty"`
	MinGroupSize           *int                   `json:"min_group_size,omitempty"`
	IdealGroupSize         *int                   `json:"ideal_group_size,omitempty"`
	MaxGroupSize           *int                   `json:"max_group_size,omitempty"`
	IndoorOutdoor          *string                `json:"indoor_outdoor,omitempty"`
	BookingRequired        bool                   `json:"booking_required"`
	WalkInAvailable        bool                   `json:"walk_in_available"`
	Status                 *string                `json:"status,omitempty"`
	DisplayOrder           int                    `json:"display_order"`
	Media                  []businessMediaRequest `json:"media,omitempty"`
}

type businessVenueExperienceResponse struct {
	ID                     int64                   `json:"id"`
	VenueID                int64                   `json:"venue_id"`
	ExperienceName         string                  `json:"experience_name"`
	Description            *string                 `json:"description,omitempty"`
	Category               *string                 `json:"category,omitempty"`
	Tags                   *string                 `json:"tags,omitempty"`
	StartingPrice          *float64                `json:"starting_price,omitempty"`
	AveragePricePerPerson  *float64                `json:"average_price_per_person,omitempty"`
	TypicalDurationMinutes *int                    `json:"typical_duration_minutes,omitempty"`
	MinGroupSize           *int                    `json:"min_group_size,omitempty"`
	IdealGroupSize         *int                    `json:"ideal_group_size,omitempty"`
	MaxGroupSize           *int                    `json:"max_group_size,omitempty"`
	IndoorOutdoor          *string                 `json:"indoor_outdoor,omitempty"`
	BookingRequired        bool                    `json:"booking_required"`
	WalkInAvailable        bool                    `json:"walk_in_available"`
	Status                 string                  `json:"status"`
	DisplayOrder           int                     `json:"display_order"`
	Media                  []businessMediaResponse `json:"media"`
}

type businessOpeningHourRequest struct {
	Weekday       int     `json:"weekday"`
	IntervalOrder int     `json:"interval_order"`
	IsClosed      bool    `json:"is_closed"`
	OpensAt       *string `json:"opens_at,omitempty"`
	ClosesAt      *string `json:"closes_at,omitempty"`
}

type businessOpeningHourResponse struct {
	Weekday       int     `json:"weekday"`
	IntervalOrder int     `json:"interval_order"`
	IsClosed      bool    `json:"is_closed"`
	OpensAt       *string `json:"opens_at,omitempty"`
	ClosesAt      *string `json:"closes_at,omitempty"`
}

type businessResponse struct {
	ID                   int64                         `json:"id"`
	Email                string                        `json:"email"`
	BusinessName         string                        `json:"business_name"`
	BusinessCategory     string                        `json:"business_category"`
	BusinessSubcategory  *string                       `json:"business_subcategory,omitempty"`
	Location             string                        `json:"location"`
	Address              *string                       `json:"address,omitempty"`
	City                 *string                       `json:"city,omitempty"`
	Area                 *string                       `json:"area,omitempty"`
	PostalCode           *string                       `json:"postal_code,omitempty"`
	GooglePlaceID        *string                       `json:"google_place_id,omitempty"`
	State                *string                       `json:"state,omitempty"`
	Country              *string                       `json:"country,omitempty"`
	District             *string                       `json:"district,omitempty"`
	Landmark             *string                       `json:"landmark,omitempty"`
	Latitude             *float64                      `json:"latitude,omitempty"`
	Longitude            *float64                      `json:"longitude,omitempty"`
	LocationAccuracy     *float64                      `json:"location_accuracy_meters,omitempty"`
	LocationVerified     bool                          `json:"location_verified"`
	VerificationLevel    string                        `json:"verification_level"`
	ServiceRadiusKM      *float64                      `json:"service_radius_km,omitempty"`
	PriceRange           *string                       `json:"price_range,omitempty"`
	MoodTags             *string                       `json:"mood_tags,omitempty"`
	ServiceTags          *string                       `json:"service_tags,omitempty"`
	BestFor              *string                       `json:"best_for,omitempty"`
	FacilityTags         *string                       `json:"facility_tags,omitempty"`
	WebsiteURL           *string                       `json:"website_url,omitempty"`
	WhatsappNumber       *string                       `json:"whatsapp_number,omitempty"`
	ContactPhone         *string                       `json:"contact_phone,omitempty"`
	Description          *string                       `json:"description,omitempty"`
	Offerings            *string                       `json:"offerings,omitempty"`
	OpeningHours         *string                       `json:"opening_hours,omitempty"`
	OpeningHoursSchedule []businessOpeningHourResponse `json:"opening_hours_schedule"`
	OpenNow              bool                          `json:"open_now"`
	Media                []businessMediaResponse       `json:"media"`
	PrimaryVenue         *businessVenueResponse        `json:"primary_venue,omitempty"`
	OnboardingStatus     string                        `json:"onboarding_status"`
	AccountStatus        string                        `json:"account_status"`
	CreatedAt            time.Time                     `json:"created_at"`
	UpdatedAt            time.Time                     `json:"updated_at"`
}

type businessVenueResponse struct {
	ID                int64                             `json:"id"`
	BusinessID        int64                             `json:"business_id"`
	VenueName         string                            `json:"venue_name"`
	IsPrimary         bool                              `json:"is_primary"`
	Location          string                            `json:"location"`
	Address           *string                           `json:"address,omitempty"`
	City              *string                           `json:"city,omitempty"`
	Area              *string                           `json:"area,omitempty"`
	PostalCode        *string                           `json:"postal_code,omitempty"`
	GooglePlaceID     *string                           `json:"google_place_id,omitempty"`
	State             *string                           `json:"state,omitempty"`
	Country           *string                           `json:"country,omitempty"`
	District          *string                           `json:"district,omitempty"`
	Landmark          *string                           `json:"landmark,omitempty"`
	Latitude          *float64                          `json:"latitude,omitempty"`
	Longitude         *float64                          `json:"longitude,omitempty"`
	LocationAccuracy  *float64                          `json:"location_accuracy_meters,omitempty"`
	LocationVerified  bool                              `json:"location_verified"`
	VerificationLevel string                            `json:"verification_level"`
	ServiceRadiusKM   *float64                          `json:"service_radius_km,omitempty"`
	OpeningHours      *string                           `json:"opening_hours,omitempty"`
	Status            string                            `json:"status"`
	Media             []businessMediaResponse           `json:"media"`
	Experiences       []businessVenueExperienceResponse `json:"experiences"`
}

const defaultBusinessSignupLocation = "Location not set"

var businessTimePattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

type businessAuthResponse struct {
	AccessToken          string           `json:"access_token"`
	AccessTokenExpiresAt time.Time        `json:"access_token_expires_at"`
	Business             businessResponse `json:"business"`
}

type businessDetailResponse struct {
	Business      businessResponse `json:"business"`
	Offers        []businessOffer  `json:"offers"`
	Events        []businessEvent  `json:"events"`
	LikesReceived int64            `json:"likes_received"`
	LikedByMe     bool             `json:"liked_by_me"`
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
	if req.Latitude != nil && (*req.Latitude < -90 || *req.Latitude > 90) {
		writeError(w, http.StatusBadRequest, "latitude must be between -90 and 90")
		return
	}
	if req.Longitude != nil && (*req.Longitude < -180 || *req.Longitude > 180) {
		writeError(w, http.StatusBadRequest, "longitude must be between -180 and 180")
		return
	}
	if req.LocationAccuracy != nil && *req.LocationAccuracy < 0 {
		writeError(w, http.StatusBadRequest, "location_accuracy_meters must be positive")
		return
	}
	signupLocation := req.Location
	if signupLocation == "" {
		signupLocation = defaultBusinessSignupLocation
	}

	duplicates, err := s.findBusinessDuplicates(r.Context(), businessDuplicateCheckRequest{
		BusinessName:  req.BusinessName,
		Location:      signupLocation,
		City:          req.City,
		Area:          req.Area,
		GooglePlaceID: req.GooglePlaceID,
	}, 5)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not check existing businesses")
		return
	}
	if hasExactBusinessDuplicate(duplicates) {
		writeJSON(w, http.StatusConflict, businessDuplicateCheckResponse{
			Matches:    duplicates,
			ExactMatch: true,
		})
		return
	}

	passwordHash, err := security.HashPassword(req.Password)
	if err != nil {
		s.logger.Error("business password hash failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not create business account")
		return
	}

	var businessID int64
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create business account")
		return
	}
	defer tx.Rollback()

	err = tx.QueryRowContext(
		r.Context(),
		`INSERT INTO business_accounts (
		     email, password_hash, business_name, business_category, business_subcategory, location,
		     address, city, area, postal_code, google_place_id, state, country, district,
		     landmark, latitude, longitude, location_accuracy_meters, contact_phone
		 )
		 VALUES (
		     $1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''),
		     NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''),
		     NULLIF($14, ''), NULLIF($15, ''), $16, $17, $18, NULLIF($19, '')
		 )
		 RETURNING id`,
		req.Email,
		passwordHash,
		req.BusinessName,
		req.BusinessCategory,
		req.BusinessSubcategory,
		signupLocation,
		req.Address,
		req.City,
		req.Area,
		req.PostalCode,
		req.GooglePlaceID,
		req.State,
		req.Country,
		req.District,
		req.Landmark,
		req.Latitude,
		req.Longitude,
		req.LocationAccuracy,
		req.ContactPhone,
	).Scan(&businessID)
	if err != nil {
		writeError(w, http.StatusConflict, "business email is already registered")
		return
	}
	if _, err := s.syncPrimaryBusinessVenue(r.Context(), tx, businessID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create business venue")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create business account")
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

func (s *Server) handleBusinessDuplicateCheck(w http.ResponseWriter, r *http.Request) {
	var req businessDuplicateCheckRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	normalizeBusinessDuplicateCheck(&req)
	if req.BusinessName == "" && req.GooglePlaceID == "" {
		writeError(w, http.StatusBadRequest, "business_name or google_place_id is required")
		return
	}

	matches, err := s.findBusinessDuplicates(r.Context(), req, 10)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not check existing businesses")
		return
	}

	writeJSON(w, http.StatusOK, businessDuplicateCheckResponse{
		Matches:    matches,
		ExactMatch: hasExactBusinessDuplicate(matches),
	})
}

func (s *Server) handleBusinessClaimCreate(w http.ResponseWriter, r *http.Request) {
	var req businessClaimRequestCreate
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.ClaimantName = strings.TrimSpace(req.ClaimantName)
	req.ClaimantPhone = strings.TrimSpace(req.ClaimantPhone)
	req.ClaimantNote = strings.TrimSpace(req.ClaimantNote)
	req.EvidenceURL = strings.TrimSpace(req.EvidenceURL)
	req.MatchSource = strings.TrimSpace(req.MatchSource)
	if req.MatchSource == "" {
		req.MatchSource = "manual"
	}
	if req.ExistingBusinessID <= 0 {
		writeError(w, http.StatusBadRequest, "existing_business_id is required")
		return
	}
	if req.ExistingBusinessID == currentBusinessID(r) {
		writeError(w, http.StatusBadRequest, "cannot claim your own business")
		return
	}
	if req.MatchSource != "google_place_id" && req.MatchSource != "name_location" && req.MatchSource != "manual" {
		writeError(w, http.StatusBadRequest, "match_source must be google_place_id, name_location, or manual")
		return
	}

	exists, err := s.businessExists(r.Context(), req.ExistingBusinessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not check existing business")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "business to claim was not found")
		return
	}

	if claim, err := s.getPendingBusinessClaim(r.Context(), req.ExistingBusinessID, currentBusinessID(r)); err == nil {
		writeJSON(w, http.StatusOK, claim)
		return
	} else if !errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "could not check existing claim")
		return
	}

	claim, err := s.createBusinessClaim(r.Context(), currentBusinessID(r), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create business claim")
		return
	}

	writeJSON(w, http.StatusCreated, claim)
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

func (s *Server) handleBusinessDetail(w http.ResponseWriter, r *http.Request) {
	businessID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid business id")
		return
	}

	business, err := s.getBusinessResponse(r.Context(), businessID)
	if errors.Is(err, sql.ErrNoRows) || business.AccountStatus != "active" {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business")
		return
	}
	business.Email = ""

	offers, err := s.getBusinessOffers(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business offers")
		return
	}
	events, err := s.getBusinessEvents(r.Context(), businessID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business events")
		return
	}

	var likesReceived int64
	if err := s.db.QueryRowContext(
		r.Context(),
		`SELECT COUNT(*) FROM business_likes WHERE business_id = $1`,
		businessID,
	).Scan(&likesReceived); err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business attention")
		return
	}

	var likedByMe bool
	if userID := currentUserID(r); userID > 0 {
		if err := s.db.QueryRowContext(
			r.Context(),
			`SELECT EXISTS (
			   SELECT 1
			   FROM business_likes
			   WHERE business_id = $1 AND user_id = $2
			 )`,
			businessID,
			userID,
		).Scan(&likedByMe); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load business attention")
			return
		}
	}

	writeJSON(w, http.StatusOK, businessDetailResponse{
		Business:      business,
		Offers:        offers,
		Events:        events,
		LikesReceived: likesReceived,
		LikedByMe:     likedByMe,
	})
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
	priceRange := strings.ToLower(strings.TrimSpace(valueOrEmpty(req.PriceRange)))
	if priceRange != "" && priceRange != "budget" && priceRange != "moderate" && priceRange != "premium" && priceRange != "luxury" {
		writeError(w, http.StatusBadRequest, "price_range must be budget, moderate, premium, or luxury")
		return
	}
	if req.Latitude != nil && (*req.Latitude < -90 || *req.Latitude > 90) {
		writeError(w, http.StatusBadRequest, "latitude must be between -90 and 90")
		return
	}
	if req.Longitude != nil && (*req.Longitude < -180 || *req.Longitude > 180) {
		writeError(w, http.StatusBadRequest, "longitude must be between -180 and 180")
		return
	}
	if req.LocationAccuracy != nil && *req.LocationAccuracy < 0 {
		writeError(w, http.StatusBadRequest, "location_accuracy_meters must be positive")
		return
	}
	if status == "submitted" {
		location := strings.TrimSpace(valueOrEmpty(req.Location))
		if location == "" || location == defaultBusinessSignupLocation || req.Latitude == nil || req.Longitude == nil {
			writeError(w, http.StatusBadRequest, "business location must be selected before submitting onboarding")
			return
		}
	}
	if req.ServiceRadiusKM != nil && *req.ServiceRadiusKM < 0 {
		writeError(w, http.StatusBadRequest, "service_radius_km must be positive")
		return
	}
	if err := validateBusinessOpeningHours(req.OpeningHoursSchedule); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateBusinessVenueExperiences(req.VenueExperiences); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateBusinessMedia(req.BusinessMedia, "business"); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateBusinessMedia(req.VenueMedia, "venue"); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update business onboarding")
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(
		r.Context(),
		`UPDATE business_accounts
		 SET business_name = COALESCE(NULLIF($2, ''), business_name),
		     business_category = COALESCE(NULLIF($3, ''), business_category),
		     business_subcategory = NULLIF($4, ''),
		     location = COALESCE(NULLIF($5, ''), location),
		     address = NULLIF($6, ''),
		     city = NULLIF($7, ''),
		     area = NULLIF($8, ''),
		     postal_code = NULLIF($9, ''),
		     google_place_id = NULLIF($10, ''),
		     state = NULLIF($11, ''),
		     country = NULLIF($12, ''),
		     district = NULLIF($13, ''),
		     landmark = NULLIF($14, ''),
		     latitude = $15,
		     longitude = $16,
		     location_accuracy_meters = $17,
		     service_radius_km = $18,
		     price_range = NULLIF($19, ''),
		     mood_tags = NULLIF($20, ''),
		     service_tags = NULLIF($21, ''),
		     best_for = NULLIF($22, ''),
		     facility_tags = NULLIF($23, ''),
		     website_url = NULLIF($24, ''),
		     whatsapp_number = NULLIF($25, ''),
		     contact_phone = NULLIF($26, ''),
		     description = NULLIF($27, ''),
		     offerings = NULLIF($28, ''),
		     opening_hours = NULLIF($29, ''),
		     onboarding_status = COALESCE(NULLIF($30, ''), onboarding_status),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND account_status = 'active'`,
		currentBusinessID(r),
		strings.TrimSpace(valueOrEmpty(req.BusinessName)),
		strings.TrimSpace(valueOrEmpty(req.BusinessCategory)),
		strings.TrimSpace(valueOrEmpty(req.BusinessSubcategory)),
		strings.TrimSpace(valueOrEmpty(req.Location)),
		strings.TrimSpace(valueOrEmpty(req.Address)),
		strings.TrimSpace(valueOrEmpty(req.City)),
		strings.TrimSpace(valueOrEmpty(req.Area)),
		strings.TrimSpace(valueOrEmpty(req.PostalCode)),
		strings.TrimSpace(valueOrEmpty(req.GooglePlaceID)),
		strings.TrimSpace(valueOrEmpty(req.State)),
		strings.TrimSpace(valueOrEmpty(req.Country)),
		strings.TrimSpace(valueOrEmpty(req.District)),
		strings.TrimSpace(valueOrEmpty(req.Landmark)),
		req.Latitude,
		req.Longitude,
		req.LocationAccuracy,
		req.ServiceRadiusKM,
		priceRange,
		cleanCommaList(valueOrEmpty(req.MoodTags)),
		cleanCommaList(valueOrEmpty(req.ServiceTags)),
		cleanCommaList(valueOrEmpty(req.BestFor)),
		cleanCommaList(valueOrEmpty(req.FacilityTags)),
		strings.TrimSpace(valueOrEmpty(req.WebsiteURL)),
		strings.TrimSpace(valueOrEmpty(req.WhatsappNumber)),
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
	if req.OpeningHoursSchedule != nil {
		if err := s.replaceBusinessOpeningHours(r.Context(), tx, currentBusinessID(r), req.OpeningHoursSchedule); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update business opening hours")
			return
		}
	}
	primaryVenueID, err := s.syncPrimaryBusinessVenue(r.Context(), tx, currentBusinessID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update business venue")
		return
	}
	if req.VenueExperiences != nil {
		if err := s.replaceVenueExperiences(r.Context(), tx, primaryVenueID, req.VenueExperiences); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update venue experiences")
			return
		}
	}
	if req.BusinessMedia != nil {
		if err := s.replaceBusinessMedia(r.Context(), tx, currentBusinessID(r), req.BusinessMedia); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update business media")
			return
		}
	}
	if req.VenueMedia != nil {
		if err := s.replaceVenueMedia(r.Context(), tx, primaryVenueID, req.VenueMedia); err != nil {
			writeError(w, http.StatusInternalServerError, "could not update venue media")
			return
		}
	}
	if err := tx.Commit(); err != nil {
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
	var businessSubcategory, address, city, area, postalCode, googlePlaceID, state, country, district, landmark sql.NullString
	var priceRange, moodTags, serviceTags, bestFor, facilityTags, websiteURL, whatsappNumber sql.NullString
	var contactPhone, description, offerings, openingHours sql.NullString
	var latitude, longitude, locationAccuracy, serviceRadiusKM sql.NullFloat64
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, email, business_name, business_category, business_subcategory, location,
		        address, city, area, postal_code, google_place_id, state, country, district, landmark,
		        latitude, longitude, location_accuracy_meters, location_verified, verification_level, service_radius_km, price_range,
		        mood_tags, service_tags, best_for, facility_tags, website_url, whatsapp_number, contact_phone, description,
		        offerings, opening_hours, onboarding_status, account_status, created_at, updated_at
		 FROM business_accounts
		 WHERE id = $1`,
		businessID,
	).Scan(
		&business.ID,
		&business.Email,
		&business.BusinessName,
		&business.BusinessCategory,
		&businessSubcategory,
		&business.Location,
		&address,
		&city,
		&area,
		&postalCode,
		&googlePlaceID,
		&state,
		&country,
		&district,
		&landmark,
		&latitude,
		&longitude,
		&locationAccuracy,
		&business.LocationVerified,
		&business.VerificationLevel,
		&serviceRadiusKM,
		&priceRange,
		&moodTags,
		&serviceTags,
		&bestFor,
		&facilityTags,
		&websiteURL,
		&whatsappNumber,
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

	business.BusinessSubcategory = nullableString(businessSubcategory)
	business.Address = nullableString(address)
	business.City = nullableString(city)
	business.Area = nullableString(area)
	business.PostalCode = nullableString(postalCode)
	business.GooglePlaceID = nullableString(googlePlaceID)
	business.State = nullableString(state)
	business.Country = nullableString(country)
	business.District = nullableString(district)
	business.Landmark = nullableString(landmark)
	business.Latitude = nullableFloat64(latitude)
	business.Longitude = nullableFloat64(longitude)
	business.LocationAccuracy = nullableFloat64(locationAccuracy)
	business.ServiceRadiusKM = nullableFloat64(serviceRadiusKM)
	business.PriceRange = nullableString(priceRange)
	business.MoodTags = nullableString(moodTags)
	business.ServiceTags = nullableString(serviceTags)
	business.BestFor = nullableString(bestFor)
	business.FacilityTags = nullableString(facilityTags)
	business.WebsiteURL = nullableString(websiteURL)
	business.WhatsappNumber = nullableString(whatsappNumber)
	business.ContactPhone = nullableString(contactPhone)
	business.Description = nullableString(description)
	business.Offerings = nullableString(offerings)
	business.OpeningHours = nullableString(openingHours)
	business.Media, err = s.getBusinessMedia(ctx, businessID)
	if err != nil {
		return businessResponse{}, err
	}
	business.OpeningHoursSchedule, err = s.getBusinessOpeningHours(ctx, businessID)
	if err != nil {
		return businessResponse{}, err
	}
	business.OpenNow = businessIsOpenNow(business.OpeningHoursSchedule, time.Now())
	business.PrimaryVenue, err = s.getPrimaryBusinessVenue(ctx, businessID)
	if err != nil {
		return businessResponse{}, err
	}
	return business, nil
}

func (s *Server) findBusinessDuplicates(ctx context.Context, req businessDuplicateCheckRequest, limit int) ([]businessDuplicateMatch, error) {
	normalizeBusinessDuplicateCheck(&req)
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, business_name, business_category, location, city, area, google_place_id,
		        verification_level,
		        CASE
		          WHEN $1 <> '' AND google_place_id = $1 THEN 'google_place_id'
		          ELSE 'name_location'
		        END AS match_type
		 FROM business_accounts
		 WHERE account_status = 'active'
		   AND (
		     ($1 <> '' AND google_place_id = $1)
		     OR (
		       $2 <> ''
		       AND lower(business_name) = lower($2)
		       AND (
		         (
		           $3 <> ''
		           AND (
		             lower(location) = lower($3)
		             OR lower(location) LIKE '%' || lower($3) || '%'
		             OR lower($3) LIKE '%' || lower(location) || '%'
		           )
		         )
		         OR (
		           $4 <> ''
		           AND city IS NOT NULL
		           AND lower(city) = lower($4)
		           AND ($5 = '' OR (area IS NOT NULL AND lower(area) = lower($5)))
		         )
		       )
		     )
		   )
		 ORDER BY CASE WHEN $1 <> '' AND google_place_id = $1 THEN 0 ELSE 1 END,
		          verification_level DESC,
		          updated_at DESC
		 LIMIT $6`,
		req.GooglePlaceID,
		req.BusinessName,
		req.Location,
		req.City,
		req.Area,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	matches := make([]businessDuplicateMatch, 0)
	for rows.Next() {
		var match businessDuplicateMatch
		var city, area, googlePlaceID sql.NullString
		if err := rows.Scan(
			&match.BusinessID,
			&match.BusinessName,
			&match.BusinessCategory,
			&match.Location,
			&city,
			&area,
			&googlePlaceID,
			&match.VerificationLevel,
			&match.MatchType,
		); err != nil {
			return nil, err
		}
		match.City = nullableString(city)
		match.Area = nullableString(area)
		match.GooglePlaceID = nullableString(googlePlaceID)
		match.ClaimAvailable = true
		matches = append(matches, match)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return matches, nil
}

func (s *Server) businessExists(ctx context.Context, businessID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(
		ctx,
		`SELECT EXISTS (
		   SELECT 1 FROM business_accounts
		   WHERE id = $1 AND account_status = 'active'
		 )`,
		businessID,
	).Scan(&exists)

	return exists, err
}

func (s *Server) getPendingBusinessClaim(ctx context.Context, existingBusinessID int64, claimantBusinessID int64) (businessClaimRequestResponse, error) {
	return s.getBusinessClaim(ctx,
		`SELECT id, existing_business_id, claimant_business_id, claimant_name, claimant_phone,
		        claimant_note, evidence_url, match_source, status, reviewed_at, created_at, updated_at
		 FROM business_claim_requests
		 WHERE existing_business_id = $1 AND claimant_business_id = $2 AND status = 'pending'
		 LIMIT 1`,
		existingBusinessID,
		claimantBusinessID,
	)
}

func (s *Server) createBusinessClaim(ctx context.Context, claimantBusinessID int64, req businessClaimRequestCreate) (businessClaimRequestResponse, error) {
	var claimID int64
	err := s.db.QueryRowContext(
		ctx,
		`INSERT INTO business_claim_requests (
		     existing_business_id, claimant_business_id, claimant_name, claimant_phone,
		     claimant_note, evidence_url, match_source
		 )
		 VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7)
		 RETURNING id`,
		req.ExistingBusinessID,
		claimantBusinessID,
		req.ClaimantName,
		req.ClaimantPhone,
		req.ClaimantNote,
		req.EvidenceURL,
		req.MatchSource,
	).Scan(&claimID)
	if err != nil {
		return businessClaimRequestResponse{}, err
	}

	return s.getBusinessClaimByID(ctx, claimID)
}

func (s *Server) getBusinessClaimByID(ctx context.Context, claimID int64) (businessClaimRequestResponse, error) {
	return s.getBusinessClaim(ctx,
		`SELECT id, existing_business_id, claimant_business_id, claimant_name, claimant_phone,
		        claimant_note, evidence_url, match_source, status, reviewed_at, created_at, updated_at
		 FROM business_claim_requests
		 WHERE id = $1`,
		claimID,
	)
}

func (s *Server) getBusinessClaim(ctx context.Context, query string, args ...any) (businessClaimRequestResponse, error) {
	var claim businessClaimRequestResponse
	var claimantName, claimantPhone, claimantNote, evidenceURL sql.NullString
	var reviewedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, query, args...).Scan(
		&claim.ID,
		&claim.ExistingBusinessID,
		&claim.ClaimantBusinessID,
		&claimantName,
		&claimantPhone,
		&claimantNote,
		&evidenceURL,
		&claim.MatchSource,
		&claim.Status,
		&reviewedAt,
		&claim.CreatedAt,
		&claim.UpdatedAt,
	)
	if err != nil {
		return businessClaimRequestResponse{}, err
	}
	claim.ClaimantName = nullableString(claimantName)
	claim.ClaimantPhone = nullableString(claimantPhone)
	claim.ClaimantNote = nullableString(claimantNote)
	claim.EvidenceURL = nullableString(evidenceURL)
	if reviewedAt.Valid {
		claim.ReviewedAt = &reviewedAt.Time
	}

	return claim, nil
}

func (s *Server) getPrimaryBusinessVenue(ctx context.Context, businessID int64) (*businessVenueResponse, error) {
	var venue businessVenueResponse
	var address, city, area, postalCode, googlePlaceID, state, country, district, landmark, openingHours sql.NullString
	var latitude, longitude, locationAccuracy, serviceRadiusKM sql.NullFloat64
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, business_id, venue_name, is_primary, location, address, city, area, postal_code,
		        google_place_id, state, country, district, landmark, latitude, longitude,
		        location_accuracy_meters, location_verified, verification_level, service_radius_km, opening_hours, status
		 FROM business_venues
		 WHERE business_id = $1 AND is_primary = true
		 LIMIT 1`,
		businessID,
	).Scan(
		&venue.ID,
		&venue.BusinessID,
		&venue.VenueName,
		&venue.IsPrimary,
		&venue.Location,
		&address,
		&city,
		&area,
		&postalCode,
		&googlePlaceID,
		&state,
		&country,
		&district,
		&landmark,
		&latitude,
		&longitude,
		&locationAccuracy,
		&venue.LocationVerified,
		&venue.VerificationLevel,
		&serviceRadiusKM,
		&openingHours,
		&venue.Status,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	venue.Address = nullableString(address)
	venue.City = nullableString(city)
	venue.Area = nullableString(area)
	venue.PostalCode = nullableString(postalCode)
	venue.GooglePlaceID = nullableString(googlePlaceID)
	venue.State = nullableString(state)
	venue.Country = nullableString(country)
	venue.District = nullableString(district)
	venue.Landmark = nullableString(landmark)
	venue.Latitude = nullableFloat64(latitude)
	venue.Longitude = nullableFloat64(longitude)
	venue.LocationAccuracy = nullableFloat64(locationAccuracy)
	venue.ServiceRadiusKM = nullableFloat64(serviceRadiusKM)
	venue.OpeningHours = nullableString(openingHours)
	venue.Media, err = s.getVenueMedia(ctx, venue.ID)
	if err != nil {
		return nil, err
	}
	experiences, err := s.getVenueExperiences(ctx, venue.ID)
	if err != nil {
		return nil, err
	}
	venue.Experiences = experiences

	return &venue, nil
}

func (s *Server) getVenueExperiences(ctx context.Context, venueID int64) ([]businessVenueExperienceResponse, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, venue_id, experience_name, description, category, tags,
		        starting_price, average_price_per_person, typical_duration_minutes,
		        min_group_size, ideal_group_size, max_group_size, indoor_outdoor,
		        booking_required, walk_in_available, status, display_order
		 FROM venue_experiences
		 WHERE venue_id = $1
		 ORDER BY display_order, id`,
		venueID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	experiences := make([]businessVenueExperienceResponse, 0)
	for rows.Next() {
		var item businessVenueExperienceResponse
		var description, category, tags, indoorOutdoor sql.NullString
		var startingPrice, averagePrice sql.NullFloat64
		var duration, minGroup, idealGroup, maxGroup sql.NullInt64
		if err := rows.Scan(
			&item.ID,
			&item.VenueID,
			&item.ExperienceName,
			&description,
			&category,
			&tags,
			&startingPrice,
			&averagePrice,
			&duration,
			&minGroup,
			&idealGroup,
			&maxGroup,
			&indoorOutdoor,
			&item.BookingRequired,
			&item.WalkInAvailable,
			&item.Status,
			&item.DisplayOrder,
		); err != nil {
			return nil, err
		}
		item.Description = nullableString(description)
		item.Category = nullableString(category)
		item.Tags = nullableString(tags)
		item.StartingPrice = nullableFloat64(startingPrice)
		item.AveragePricePerPerson = nullableFloat64(averagePrice)
		item.TypicalDurationMinutes = nullableInt(duration)
		item.MinGroupSize = nullableInt(minGroup)
		item.IdealGroupSize = nullableInt(idealGroup)
		item.MaxGroupSize = nullableInt(maxGroup)
		item.IndoorOutdoor = nullableString(indoorOutdoor)
		item.Media, err = s.getExperienceMedia(ctx, item.ID)
		if err != nil {
			return nil, err
		}
		experiences = append(experiences, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return experiences, nil
}

func (s *Server) getBusinessOpeningHours(ctx context.Context, businessID int64) ([]businessOpeningHourResponse, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT weekday, interval_order, is_closed, opens_at, closes_at
		 FROM business_opening_hours
		 WHERE business_id = $1
		 ORDER BY weekday, interval_order`,
		businessID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	schedule := make([]businessOpeningHourResponse, 0)
	for rows.Next() {
		var item businessOpeningHourResponse
		var opensAt, closesAt sql.NullString
		if err := rows.Scan(&item.Weekday, &item.IntervalOrder, &item.IsClosed, &opensAt, &closesAt); err != nil {
			return nil, err
		}
		item.OpensAt = nullableString(opensAt)
		item.ClosesAt = nullableString(closesAt)
		schedule = append(schedule, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return schedule, nil
}

func (s *Server) getBusinessMedia(ctx context.Context, businessID int64) ([]businessMediaResponse, error) {
	return s.getBusinessMediaRows(ctx,
		`SELECT id, media_type, purpose, cloudinary_public_id, secure_url, thumbnail_url,
		        width, height, duration_seconds, alt_text, display_order, status
		 FROM business_media
		 WHERE business_id = $1 AND status = 'active'
		 ORDER BY purpose, display_order, id`,
		businessID,
	)
}

func (s *Server) getVenueMedia(ctx context.Context, venueID int64) ([]businessMediaResponse, error) {
	return s.getBusinessMediaRows(ctx,
		`SELECT id, media_type, purpose, cloudinary_public_id, secure_url, thumbnail_url,
		        width, height, duration_seconds, alt_text, display_order, status
		 FROM venue_media
		 WHERE venue_id = $1 AND status = 'active'
		 ORDER BY purpose, display_order, id`,
		venueID,
	)
}

func (s *Server) getExperienceMedia(ctx context.Context, experienceID int64) ([]businessMediaResponse, error) {
	return s.getBusinessMediaRows(ctx,
		`SELECT id, media_type, purpose, cloudinary_public_id, secure_url, thumbnail_url,
		        width, height, duration_seconds, alt_text, display_order, status
		 FROM experience_media
		 WHERE experience_id = $1 AND status = 'active'
		 ORDER BY purpose, display_order, id`,
		experienceID,
	)
}

func (s *Server) getBusinessMediaRows(ctx context.Context, query string, targetID int64) ([]businessMediaResponse, error) {
	rows, err := s.db.QueryContext(ctx, query, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	media := make([]businessMediaResponse, 0)
	for rows.Next() {
		var item businessMediaResponse
		var thumbnailURL, altText sql.NullString
		var width, height, duration sql.NullInt64
		if err := rows.Scan(
			&item.ID,
			&item.MediaType,
			&item.Purpose,
			&item.CloudinaryPublicID,
			&item.SecureURL,
			&thumbnailURL,
			&width,
			&height,
			&duration,
			&altText,
			&item.DisplayOrder,
			&item.Status,
		); err != nil {
			return nil, err
		}
		item.ThumbnailURL = nullableString(thumbnailURL)
		item.Width = nullableInt(width)
		item.Height = nullableInt(height)
		item.DurationSeconds = nullableInt(duration)
		item.AltText = nullableString(altText)
		media = append(media, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return media, nil
}

func (s *Server) replaceBusinessOpeningHours(ctx context.Context, tx *sql.Tx, businessID int64, schedule []businessOpeningHourRequest) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM business_opening_hours WHERE business_id = $1`, businessID); err != nil {
		return err
	}

	for _, item := range normalizeBusinessOpeningHours(schedule) {
		var opensAt, closesAt any
		if !item.IsClosed {
			opensAt = strings.TrimSpace(valueOrEmpty(item.OpensAt))
			closesAt = strings.TrimSpace(valueOrEmpty(item.ClosesAt))
		}
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO business_opening_hours
			   (business_id, weekday, interval_order, is_closed, opens_at, closes_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			businessID,
			item.Weekday,
			item.IntervalOrder,
			item.IsClosed,
			opensAt,
			closesAt,
		); err != nil {
			return err
		}
	}

	return nil
}

func (s *Server) replaceBusinessMedia(ctx context.Context, tx *sql.Tx, businessID int64, media []businessMediaRequest) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM business_media WHERE business_id = $1`, businessID); err != nil {
		return err
	}

	for index, item := range normalizeBusinessMedia(media) {
		if err := insertBusinessMedia(ctx, tx,
			`INSERT INTO business_media (
			     business_id, media_type, purpose, cloudinary_public_id, secure_url,
			     thumbnail_url, width, height, duration_seconds, alt_text, display_order, status
			 )
			 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, NULLIF($10, ''), $11, $12)`,
			businessID,
			item,
			index,
		); err != nil {
			return err
		}
	}

	return nil
}

func (s *Server) replaceVenueMedia(ctx context.Context, tx *sql.Tx, venueID int64, media []businessMediaRequest) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM venue_media WHERE venue_id = $1`, venueID); err != nil {
		return err
	}

	for index, item := range normalizeBusinessMedia(media) {
		if err := insertBusinessMedia(ctx, tx,
			`INSERT INTO venue_media (
			     venue_id, media_type, purpose, cloudinary_public_id, secure_url,
			     thumbnail_url, width, height, duration_seconds, alt_text, display_order, status
			 )
			 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, NULLIF($10, ''), $11, $12)`,
			venueID,
			item,
			index,
		); err != nil {
			return err
		}
	}

	return nil
}

func (s *Server) replaceExperienceMedia(ctx context.Context, tx *sql.Tx, experienceID int64, media []businessMediaRequest) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM experience_media WHERE experience_id = $1`, experienceID); err != nil {
		return err
	}

	for index, item := range normalizeBusinessMedia(media) {
		if err := insertBusinessMedia(ctx, tx,
			`INSERT INTO experience_media (
			     experience_id, media_type, purpose, cloudinary_public_id, secure_url,
			     thumbnail_url, width, height, duration_seconds, alt_text, display_order, status
			 )
			 VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, NULLIF($10, ''), $11, $12)`,
			experienceID,
			item,
			index,
		); err != nil {
			return err
		}
	}

	return nil
}

func insertBusinessMedia(ctx context.Context, tx *sql.Tx, query string, targetID int64, item businessMediaRequest, index int) error {
	displayOrder := item.DisplayOrder
	if displayOrder < 0 {
		displayOrder = index
	}
	status := strings.TrimSpace(valueOrEmpty(item.Status))
	if status == "" {
		status = "active"
	}
	_, err := tx.ExecContext(
		ctx,
		query,
		targetID,
		strings.TrimSpace(item.MediaType),
		strings.TrimSpace(item.Purpose),
		strings.TrimSpace(item.CloudinaryPublicID),
		strings.TrimSpace(item.SecureURL),
		strings.TrimSpace(valueOrEmpty(item.ThumbnailURL)),
		item.Width,
		item.Height,
		item.DurationSeconds,
		strings.TrimSpace(valueOrEmpty(item.AltText)),
		displayOrder,
		status,
	)

	return err
}

func (s *Server) syncPrimaryBusinessVenue(ctx context.Context, tx *sql.Tx, businessID int64) (int64, error) {
	var venueID int64
	err := tx.QueryRowContext(
		ctx,
		`INSERT INTO business_venues (
		     business_id, venue_name, is_primary, location, address, city, area, postal_code,
		     google_place_id, state, country, district, landmark, latitude, longitude,
		     location_accuracy_meters, location_verified, verification_level, service_radius_km, opening_hours, status
		 )
		 SELECT
		     id, business_name, true, location, address, city, area, postal_code,
		     google_place_id, state, country, district, landmark, latitude, longitude,
		     location_accuracy_meters, location_verified, verification_level, service_radius_km, opening_hours,
		     CASE WHEN account_status = 'active' THEN 'active' ELSE 'inactive' END
		 FROM business_accounts
		 WHERE id = $1
		 ON CONFLICT (business_id) WHERE is_primary = true
		 DO UPDATE SET
		     venue_name = EXCLUDED.venue_name,
		     location = EXCLUDED.location,
		     address = EXCLUDED.address,
		     city = EXCLUDED.city,
		     area = EXCLUDED.area,
		     postal_code = EXCLUDED.postal_code,
		     google_place_id = EXCLUDED.google_place_id,
		     state = EXCLUDED.state,
		     country = EXCLUDED.country,
		     district = EXCLUDED.district,
		     landmark = EXCLUDED.landmark,
		     latitude = EXCLUDED.latitude,
		     longitude = EXCLUDED.longitude,
		     location_accuracy_meters = EXCLUDED.location_accuracy_meters,
		     location_verified = EXCLUDED.location_verified,
		     verification_level = EXCLUDED.verification_level,
		     service_radius_km = EXCLUDED.service_radius_km,
		     opening_hours = EXCLUDED.opening_hours,
		     status = EXCLUDED.status,
		     updated_at = CURRENT_TIMESTAMP
		 RETURNING id`,
		businessID,
	).Scan(&venueID)

	return venueID, err
}

func (s *Server) replaceVenueExperiences(ctx context.Context, tx *sql.Tx, venueID int64, experiences []businessVenueExperienceRequest) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM venue_experiences WHERE venue_id = $1`, venueID); err != nil {
		return err
	}

	for index, item := range normalizeBusinessVenueExperiences(experiences) {
		status := strings.TrimSpace(valueOrEmpty(item.Status))
		if status == "" {
			status = "active"
		}
		displayOrder := item.DisplayOrder
		if displayOrder <= 0 {
			displayOrder = index + 1
		}
		var experienceID int64
		if err := tx.QueryRowContext(
			ctx,
			`INSERT INTO venue_experiences (
			     venue_id, experience_name, description, category, tags,
			     starting_price, average_price_per_person, typical_duration_minutes,
			     min_group_size, ideal_group_size, max_group_size, indoor_outdoor,
			     booking_required, walk_in_available, status, display_order
			 )
			 VALUES (
			     $1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''),
			     $6, $7, $8, $9, $10, $11, NULLIF($12, ''),
			     $13, $14, $15, $16
			 )
			 RETURNING id`,
			venueID,
			strings.TrimSpace(item.ExperienceName),
			strings.TrimSpace(valueOrEmpty(item.Description)),
			strings.TrimSpace(valueOrEmpty(item.Category)),
			cleanCommaList(valueOrEmpty(item.Tags)),
			item.StartingPrice,
			item.AveragePricePerPerson,
			item.TypicalDurationMinutes,
			item.MinGroupSize,
			item.IdealGroupSize,
			item.MaxGroupSize,
			strings.TrimSpace(valueOrEmpty(item.IndoorOutdoor)),
			item.BookingRequired,
			item.WalkInAvailable,
			status,
			displayOrder,
		).Scan(&experienceID); err != nil {
			return err
		}
		if item.Media != nil {
			if err := s.replaceExperienceMedia(ctx, tx, experienceID, item.Media); err != nil {
				return err
			}
		}
	}

	return nil
}

func validateBusinessOpeningHours(schedule []businessOpeningHourRequest) error {
	seen := make(map[[2]int]struct{}, len(schedule))
	closedDays := make(map[int]struct{})
	openDays := make(map[int]struct{})
	for _, item := range schedule {
		if item.Weekday < 0 || item.Weekday > 6 {
			return errors.New("opening_hours_schedule weekday must be between 0 and 6")
		}
		if item.IntervalOrder < 1 || item.IntervalOrder > 4 {
			return errors.New("opening_hours_schedule interval_order must be between 1 and 4")
		}
		key := [2]int{item.Weekday, item.IntervalOrder}
		if _, exists := seen[key]; exists {
			return errors.New("opening_hours_schedule contains duplicate intervals")
		}
		seen[key] = struct{}{}
		if item.IsClosed {
			if _, exists := openDays[item.Weekday]; exists {
				return errors.New("opening_hours_schedule day cannot be both open and closed")
			}
			closedDays[item.Weekday] = struct{}{}
			continue
		}
		if _, exists := closedDays[item.Weekday]; exists {
			return errors.New("opening_hours_schedule day cannot be both open and closed")
		}
		openDays[item.Weekday] = struct{}{}
		opensAt := strings.TrimSpace(valueOrEmpty(item.OpensAt))
		closesAt := strings.TrimSpace(valueOrEmpty(item.ClosesAt))
		if !businessTimePattern.MatchString(opensAt) || !businessTimePattern.MatchString(closesAt) {
			return errors.New("opening_hours_schedule times must use HH:MM 24-hour format")
		}
	}

	return nil
}

func validateBusinessVenueExperiences(experiences []businessVenueExperienceRequest) error {
	for _, item := range normalizeBusinessVenueExperiences(experiences) {
		if strings.TrimSpace(item.ExperienceName) == "" {
			return errors.New("venue_experiences experience_name is required")
		}
		if item.StartingPrice != nil && *item.StartingPrice < 0 {
			return errors.New("venue_experiences starting_price must be positive")
		}
		if item.AveragePricePerPerson != nil && *item.AveragePricePerPerson < 0 {
			return errors.New("venue_experiences average_price_per_person must be positive")
		}
		if item.TypicalDurationMinutes != nil && *item.TypicalDurationMinutes <= 0 {
			return errors.New("venue_experiences typical_duration_minutes must be positive")
		}
		if item.MinGroupSize != nil && *item.MinGroupSize <= 0 {
			return errors.New("venue_experiences min_group_size must be positive")
		}
		if item.IdealGroupSize != nil && *item.IdealGroupSize <= 0 {
			return errors.New("venue_experiences ideal_group_size must be positive")
		}
		if item.MaxGroupSize != nil && *item.MaxGroupSize <= 0 {
			return errors.New("venue_experiences max_group_size must be positive")
		}
		if item.MinGroupSize != nil && item.MaxGroupSize != nil && *item.MinGroupSize > *item.MaxGroupSize {
			return errors.New("venue_experiences min_group_size cannot exceed max_group_size")
		}
		indoorOutdoor := strings.TrimSpace(valueOrEmpty(item.IndoorOutdoor))
		if indoorOutdoor != "" && indoorOutdoor != "indoor" && indoorOutdoor != "outdoor" && indoorOutdoor != "both" {
			return errors.New("venue_experiences indoor_outdoor must be indoor, outdoor, or both")
		}
		status := strings.TrimSpace(valueOrEmpty(item.Status))
		if status != "" && status != "draft" && status != "active" && status != "inactive" {
			return errors.New("venue_experiences status must be draft, active, or inactive")
		}
		if err := validateBusinessMedia(item.Media, "experience"); err != nil {
			return err
		}
	}

	return nil
}

func validateBusinessMedia(media []businessMediaRequest, scope string) error {
	for _, item := range normalizeBusinessMedia(media) {
		mediaType := strings.TrimSpace(item.MediaType)
		if mediaType != "image" && mediaType != "video" {
			return errors.New(scope + "_media media_type must be image or video")
		}
		if strings.TrimSpace(item.CloudinaryPublicID) == "" || strings.TrimSpace(item.SecureURL) == "" {
			return errors.New(scope + "_media cloudinary_public_id and secure_url are required")
		}
		purpose := strings.TrimSpace(item.Purpose)
		if !businessMediaPurposeAllowed(scope, purpose) {
			return errors.New(scope + "_media purpose is not supported")
		}
		if item.Width != nil && *item.Width < 0 {
			return errors.New(scope + "_media width must be positive")
		}
		if item.Height != nil && *item.Height < 0 {
			return errors.New(scope + "_media height must be positive")
		}
		if item.DurationSeconds != nil && *item.DurationSeconds < 0 {
			return errors.New(scope + "_media duration_seconds must be positive")
		}
		if item.DisplayOrder < 0 {
			return errors.New(scope + "_media display_order must be positive")
		}
		status := strings.TrimSpace(valueOrEmpty(item.Status))
		if status != "" && status != "active" && status != "hidden" {
			return errors.New(scope + "_media status must be active or hidden")
		}
	}

	return nil
}

func businessMediaPurposeAllowed(scope string, purpose string) bool {
	if scope == "experience" {
		return purpose == "cover" || purpose == "gallery" || purpose == "activity" || purpose == "video"
	}

	return purpose == "cover" || purpose == "gallery" || purpose == "food" || purpose == "activity" || purpose == "menu" || purpose == "video"
}

func normalizeBusinessVenueExperiences(experiences []businessVenueExperienceRequest) []businessVenueExperienceRequest {
	normalized := make([]businessVenueExperienceRequest, 0, len(experiences))
	for _, item := range experiences {
		if strings.TrimSpace(item.ExperienceName) == "" &&
			strings.TrimSpace(valueOrEmpty(item.Description)) == "" &&
			strings.TrimSpace(valueOrEmpty(item.Category)) == "" {
			continue
		}
		normalized = append(normalized, item)
	}

	return normalized
}

func normalizeBusinessMedia(media []businessMediaRequest) []businessMediaRequest {
	normalized := make([]businessMediaRequest, 0, len(media))
	seen := make(map[string]struct{}, len(media))
	for _, item := range media {
		item.MediaType = strings.TrimSpace(item.MediaType)
		item.Purpose = strings.TrimSpace(item.Purpose)
		item.CloudinaryPublicID = strings.TrimSpace(item.CloudinaryPublicID)
		item.SecureURL = strings.TrimSpace(item.SecureURL)
		if item.CloudinaryPublicID == "" && item.SecureURL == "" {
			continue
		}
		key := item.CloudinaryPublicID
		if key == "" {
			key = item.SecureURL
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, item)
	}

	return normalized
}

func normalizeBusinessOpeningHours(schedule []businessOpeningHourRequest) []businessOpeningHourRequest {
	normalized := make([]businessOpeningHourRequest, 0, len(schedule))
	closedDays := make(map[int]struct{})
	for _, item := range schedule {
		if item.IsClosed {
			if _, exists := closedDays[item.Weekday]; exists {
				continue
			}
			closedDays[item.Weekday] = struct{}{}
			normalized = append(normalized, businessOpeningHourRequest{
				Weekday:       item.Weekday,
				IntervalOrder: 1,
				IsClosed:      true,
			})
			continue
		}
		if _, closed := closedDays[item.Weekday]; closed {
			continue
		}
		normalized = append(normalized, item)
	}

	return normalized
}

func businessIsOpenNow(schedule []businessOpeningHourResponse, now time.Time) bool {
	if len(schedule) == 0 {
		return false
	}
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		location = time.Local
	}
	localNow := now.In(location)
	currentWeekday := (int(localNow.Weekday()) + 6) % 7
	previousWeekday := (currentWeekday + 6) % 7
	currentMinute := localNow.Hour()*60 + localNow.Minute()

	for _, item := range schedule {
		if item.IsClosed || item.OpensAt == nil || item.ClosesAt == nil {
			continue
		}
		opensAt, ok := timeValueToMinutes(*item.OpensAt)
		if !ok {
			continue
		}
		closesAt, ok := timeValueToMinutes(*item.ClosesAt)
		if !ok {
			continue
		}
		if opensAt < closesAt && item.Weekday == currentWeekday && currentMinute >= opensAt && currentMinute < closesAt {
			return true
		}
		if opensAt > closesAt {
			if item.Weekday == currentWeekday && currentMinute >= opensAt {
				return true
			}
			if item.Weekday == previousWeekday && currentMinute < closesAt {
				return true
			}
		}
	}

	return false
}

func timeValueToMinutes(value string) (int, bool) {
	if !businessTimePattern.MatchString(value) {
		return 0, false
	}
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		return 0, false
	}

	return parsed.Hour()*60 + parsed.Minute(), true
}

func normalizeBusinessSignup(req *businessSignupRequest) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.BusinessName = strings.TrimSpace(req.BusinessName)
	req.BusinessCategory = strings.TrimSpace(req.BusinessCategory)
	req.Location = strings.TrimSpace(req.Location)
	req.Address = strings.TrimSpace(req.Address)
	req.City = strings.TrimSpace(req.City)
	req.Area = strings.TrimSpace(req.Area)
	req.PostalCode = strings.TrimSpace(req.PostalCode)
	req.GooglePlaceID = strings.TrimSpace(req.GooglePlaceID)
	req.State = strings.TrimSpace(req.State)
	req.Country = strings.TrimSpace(req.Country)
	req.District = strings.TrimSpace(req.District)
	req.Landmark = strings.TrimSpace(req.Landmark)
	req.ContactPhone = strings.TrimSpace(req.ContactPhone)
}

func normalizeBusinessDuplicateCheck(req *businessDuplicateCheckRequest) {
	req.BusinessName = strings.TrimSpace(req.BusinessName)
	req.Location = strings.TrimSpace(req.Location)
	req.City = strings.TrimSpace(req.City)
	req.Area = strings.TrimSpace(req.Area)
	req.GooglePlaceID = strings.TrimSpace(req.GooglePlaceID)
}

func hasExactBusinessDuplicate(matches []businessDuplicateMatch) bool {
	for _, match := range matches {
		if match.MatchType == "google_place_id" {
			return true
		}
	}

	return false
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

	return nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}

	return *value
}

func nullableFloat64(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}

	return &value.Float64
}

func cleanCommaList(value string) string {
	parts := strings.Split(value, ",")
	cleaned := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		item := strings.ToLower(strings.TrimSpace(part))
		if item == "" {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		cleaned = append(cleaned, item)
	}

	return strings.Join(cleaned, ", ")
}
