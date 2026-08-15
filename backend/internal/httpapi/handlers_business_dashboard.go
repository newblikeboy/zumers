package httpapi

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type businessDashboardUpdateRequest struct {
	TodayUpdate     *string `json:"today_update"`
	TodayHighlight  *string `json:"today_highlight"`
	OfferTitle      *string `json:"offer_title"`
	OfferDetails    *string `json:"offer_details"`
	OfferValidUntil *string `json:"offer_valid_until"`
	OfferStatus     *string `json:"offer_status"`
}

type businessDashboardResponse struct {
	TodayUpdate     *string                  `json:"today_update,omitempty"`
	TodayHighlight  *string                  `json:"today_highlight,omitempty"`
	OfferTitle      *string                  `json:"offer_title,omitempty"`
	OfferDetails    *string                  `json:"offer_details,omitempty"`
	OfferValidUntil *string                  `json:"offer_valid_until,omitempty"`
	OfferStatus     string                   `json:"offer_status"`
	OfferClicks     int64                    `json:"offer_clicks"`
	ProfileVisits   int64                    `json:"profile_visits"`
	BookingClicks   int64                    `json:"booking_clicks"`
	DirectionClicks int64                    `json:"direction_clicks"`
	Saves           int64                    `json:"saves"`
	UpdatedAt       time.Time                `json:"updated_at"`
	Bookings        []businessBookingRequest `json:"bookings"`
}

type businessBookingRequest struct {
	ID               int64      `json:"id"`
	RequesterName    string     `json:"requester_name"`
	RequesterContact *string    `json:"requester_contact,omitempty"`
	BookingNote      *string    `json:"booking_note,omitempty"`
	BookingTime      *time.Time `json:"booking_time,omitempty"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func (s *Server) handleBusinessDashboard(w http.ResponseWriter, r *http.Request) {
	dashboard, err := s.getBusinessDashboard(r.Context(), currentBusinessID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business dashboard")
		return
	}

	writeJSON(w, http.StatusOK, dashboard)
}

func (s *Server) handleBusinessDashboardUpdate(w http.ResponseWriter, r *http.Request) {
	var req businessDashboardUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	offerStatus := strings.TrimSpace(valueOrEmpty(req.OfferStatus))
	if offerStatus != "" && offerStatus != "draft" && offerStatus != "active" && offerStatus != "paused" {
		writeError(w, http.StatusBadRequest, "invalid offer status")
		return
	}

	var offerValidUntil any
	if value := strings.TrimSpace(valueOrEmpty(req.OfferValidUntil)); value != "" {
		parsed, err := time.Parse("2006-01-02", value)
		if err != nil {
			writeError(w, http.StatusBadRequest, "offer valid until must use YYYY-MM-DD")
			return
		}
		offerValidUntil = parsed
	}

	_, err := s.db.ExecContext(
		r.Context(),
		`INSERT INTO business_dashboard_controls (
		   business_id, today_update, today_highlight, offer_title, offer_details, offer_valid_until, offer_status
		 )
		 VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6, COALESCE(NULLIF($7, ''), 'draft'))
		 ON CONFLICT (business_id) DO UPDATE
		 SET today_update = COALESCE(NULLIF($2, ''), business_dashboard_controls.today_update),
		     today_highlight = COALESCE(NULLIF($3, ''), business_dashboard_controls.today_highlight),
		     offer_title = COALESCE(NULLIF($4, ''), business_dashboard_controls.offer_title),
		     offer_details = COALESCE(NULLIF($5, ''), business_dashboard_controls.offer_details),
		     offer_valid_until = COALESCE($6, business_dashboard_controls.offer_valid_until),
		     offer_status = COALESCE(NULLIF($7, ''), business_dashboard_controls.offer_status),
		     updated_at = CURRENT_TIMESTAMP`,
		currentBusinessID(r),
		strings.TrimSpace(valueOrEmpty(req.TodayUpdate)),
		strings.TrimSpace(valueOrEmpty(req.TodayHighlight)),
		strings.TrimSpace(valueOrEmpty(req.OfferTitle)),
		strings.TrimSpace(valueOrEmpty(req.OfferDetails)),
		offerValidUntil,
		offerStatus,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update business dashboard")
		return
	}

	dashboard, err := s.getBusinessDashboard(r.Context(), currentBusinessID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load business dashboard")
		return
	}

	writeJSON(w, http.StatusOK, dashboard)
}

func (s *Server) getBusinessDashboard(ctx context.Context, businessID int64) (businessDashboardResponse, error) {
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO business_dashboard_controls (business_id)
		 VALUES ($1)
		 ON CONFLICT (business_id) DO NOTHING`,
		businessID,
	)
	if err != nil {
		return businessDashboardResponse{}, err
	}

	var dashboard businessDashboardResponse
	var todayUpdate, todayHighlight, offerTitle, offerDetails sql.NullString
	var offerValidUntil sql.NullTime
	err = s.db.QueryRowContext(
		ctx,
		`SELECT today_update, today_highlight, offer_title, offer_details, offer_valid_until,
		        offer_status, offer_clicks, profile_visits, booking_clicks, direction_clicks, saves, updated_at
		 FROM business_dashboard_controls
		 WHERE business_id = $1`,
		businessID,
	).Scan(
		&todayUpdate,
		&todayHighlight,
		&offerTitle,
		&offerDetails,
		&offerValidUntil,
		&dashboard.OfferStatus,
		&dashboard.OfferClicks,
		&dashboard.ProfileVisits,
		&dashboard.BookingClicks,
		&dashboard.DirectionClicks,
		&dashboard.Saves,
		&dashboard.UpdatedAt,
	)
	if err != nil {
		return businessDashboardResponse{}, err
	}

	dashboard.TodayUpdate = nullableString(todayUpdate)
	dashboard.TodayHighlight = nullableString(todayHighlight)
	dashboard.OfferTitle = nullableString(offerTitle)
	dashboard.OfferDetails = nullableString(offerDetails)
	dashboard.OfferValidUntil = nullableDateString(offerValidUntil)

	bookings, err := s.getBusinessBookings(ctx, businessID)
	if err != nil {
		return businessDashboardResponse{}, err
	}
	dashboard.Bookings = bookings

	return dashboard, nil
}

func (s *Server) getBusinessBookings(ctx context.Context, businessID int64) ([]businessBookingRequest, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, requester_name, requester_contact, booking_note, booking_time, status, created_at, updated_at
		 FROM business_booking_requests
		 WHERE business_id = $1
		 ORDER BY created_at DESC
		 LIMIT 20`,
		businessID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bookings := make([]businessBookingRequest, 0)
	for rows.Next() {
		var booking businessBookingRequest
		var requesterContact, bookingNote sql.NullString
		var bookingTime sql.NullTime
		if err := rows.Scan(
			&booking.ID,
			&booking.RequesterName,
			&requesterContact,
			&bookingNote,
			&bookingTime,
			&booking.Status,
			&booking.CreatedAt,
			&booking.UpdatedAt,
		); err != nil {
			return nil, err
		}
		booking.RequesterContact = nullableString(requesterContact)
		booking.BookingNote = nullableString(bookingNote)
		if bookingTime.Valid {
			booking.BookingTime = &bookingTime.Time
		}
		bookings = append(bookings, booking)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return bookings, nil
}

func nullableDateString(value sql.NullTime) *string {
	if !value.Valid {
		return nil
	}

	formatted := value.Time.Format("2006-01-02")
	return &formatted
}
