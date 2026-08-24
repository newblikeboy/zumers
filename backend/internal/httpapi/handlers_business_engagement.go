package httpapi

import (
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type businessLikeResponse struct {
	BusinessID    int64 `json:"business_id"`
	Liked         bool  `json:"liked"`
	LikesReceived int64 `json:"likes_received"`
}

type businessBookingCreateRequest struct {
	RequesterName    string  `json:"requester_name"`
	RequesterContact *string `json:"requester_contact"`
	BookingNote      *string `json:"booking_note"`
	BookingTime      *string `json:"booking_time"`
}

func (s *Server) handleBusinessLikeSet(w http.ResponseWriter, r *http.Request) {
	businessID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid business id")
		return
	}
	if !s.activeBusinessExists(r, businessID) {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	_, err = s.db.ExecContext(
		r.Context(),
		`INSERT INTO business_likes (business_id, user_id)
		 VALUES ($1, $2)
		 ON CONFLICT (business_id, user_id) DO NOTHING`,
		businessID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not like business")
		return
	}

	s.writeBusinessLikeResponse(w, r, businessID, true)
}

func (s *Server) handleBusinessLikeDelete(w http.ResponseWriter, r *http.Request) {
	businessID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid business id")
		return
	}
	if !s.activeBusinessExists(r, businessID) {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	_, err = s.db.ExecContext(
		r.Context(),
		`DELETE FROM business_likes WHERE business_id = $1 AND user_id = $2`,
		businessID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove business like")
		return
	}

	s.writeBusinessLikeResponse(w, r, businessID, false)
}

func (s *Server) handleBusinessBookingCreate(w http.ResponseWriter, r *http.Request) {
	businessID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid business id")
		return
	}
	if !s.activeBusinessExists(r, businessID) {
		writeError(w, http.StatusNotFound, "business not found")
		return
	}

	var req businessBookingCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	requesterName := strings.TrimSpace(req.RequesterName)
	if requesterName == "" {
		writeError(w, http.StatusBadRequest, "requester name is required")
		return
	}
	if len(requesterName) > 160 {
		writeError(w, http.StatusBadRequest, "requester name is too long")
		return
	}

	requesterContact := cleanOptionalString(req.RequesterContact)
	if requesterContact != nil && len(*requesterContact) > 160 {
		writeError(w, http.StatusBadRequest, "requester contact is too long")
		return
	}
	bookingNote := cleanOptionalString(req.BookingNote)
	var bookingTime any
	if req.BookingTime != nil && strings.TrimSpace(*req.BookingTime) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.BookingTime))
		if err != nil {
			writeError(w, http.StatusBadRequest, "booking time must be a valid RFC3339 timestamp")
			return
		}
		bookingTime = parsed
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create booking")
		return
	}
	defer tx.Rollback()

	var booking businessBookingRequest
	var scannedContact, scannedNote sql.NullString
	var scannedTime sql.NullTime
	if err := tx.QueryRowContext(
		r.Context(),
		`INSERT INTO business_booking_requests (
		   business_id, requester_name, requester_contact, booking_note, booking_time, status
		 )
		 VALUES ($1, $2, $3, $4, $5, 'pending')
		 RETURNING id, requester_name, requester_contact, booking_note, booking_time, status, created_at, updated_at`,
		businessID,
		requesterName,
		requesterContact,
		bookingNote,
		bookingTime,
	).Scan(
		&booking.ID,
		&booking.RequesterName,
		&scannedContact,
		&scannedNote,
		&scannedTime,
		&booking.Status,
		&booking.CreatedAt,
		&booking.UpdatedAt,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create booking")
		return
	}

	if _, err := tx.ExecContext(
		r.Context(),
		`INSERT INTO business_dashboard_controls (business_id, booking_clicks)
		 VALUES ($1, 1)
		 ON CONFLICT (business_id)
		 DO UPDATE SET booking_clicks = business_dashboard_controls.booking_clicks + 1,
		               updated_at = CURRENT_TIMESTAMP`,
		businessID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "could not update booking metrics")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create booking")
		return
	}

	booking.RequesterContact = nullableString(scannedContact)
	booking.BookingNote = nullableString(scannedNote)
	if scannedTime.Valid {
		booking.BookingTime = &scannedTime.Time
	}
	writeJSON(w, http.StatusCreated, booking)
}

func (s *Server) activeBusinessExists(r *http.Request, businessID int64) bool {
	var exists bool
	err := s.db.QueryRowContext(
		r.Context(),
		`SELECT EXISTS (
		   SELECT 1
		   FROM business_accounts
		   WHERE id = $1 AND account_status = 'active'
		 )`,
		businessID,
	).Scan(&exists)
	return err == nil && exists
}

func cleanOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	cleaned := strings.TrimSpace(*value)
	if cleaned == "" {
		return nil
	}
	return &cleaned
}

func (s *Server) writeBusinessLikeResponse(w http.ResponseWriter, r *http.Request, businessID int64, liked bool) {
	var likesReceived int64
	if err := s.db.QueryRowContext(
		r.Context(),
		`SELECT COUNT(*) FROM business_likes WHERE business_id = $1`,
		businessID,
	).Scan(&likesReceived); err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business likes")
		return
	}

	writeJSON(w, http.StatusOK, businessLikeResponse{
		BusinessID:    businessID,
		Liked:         liked,
		LikesReceived: likesReceived,
	})
}
