package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"
)

type businessDashboardUpdateRequest struct {
	TodayUpdate     *string `json:"today_update"`
	TodayHighlight  *string `json:"today_highlight"`
	OfferID         *int64  `json:"offer_id"`
	OfferTitle      *string `json:"offer_title"`
	OfferDetails    *string `json:"offer_details"`
	OfferValidUntil *string `json:"offer_valid_until"`
	OfferStatus     *string `json:"offer_status"`
	EventID         *int64  `json:"event_id"`
	EventTitle      *string `json:"event_title"`
	EventDetails    *string `json:"event_details"`
	EventType       *string `json:"event_type"`
	EventStartsAt   *string `json:"event_starts_at"`
	EventEndsAt     *string `json:"event_ends_at"`
	EventStatus     *string `json:"event_status"`
}

type businessDashboardResponse struct {
	OfferID         *int64                   `json:"offer_id,omitempty"`
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
	Offers          []businessOffer          `json:"offers"`
	Events          []businessEvent          `json:"events"`
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

type businessOffer struct {
	ID              int64     `json:"id"`
	BusinessID      int64     `json:"business_id"`
	VenueID         *int64    `json:"venue_id,omitempty"`
	Title           string    `json:"title"`
	Description     *string   `json:"description,omitempty"`
	OriginalPrice   *float64  `json:"original_price,omitempty"`
	OfferPrice      *float64  `json:"offer_price,omitempty"`
	DiscountPercent *float64  `json:"discount_percent,omitempty"`
	DiscountAmount  *float64  `json:"discount_amount,omitempty"`
	StartsOn        *string   `json:"starts_on,omitempty"`
	EndsOn          *string   `json:"ends_on,omitempty"`
	StartsAt        *string   `json:"starts_at,omitempty"`
	EndsAt          *string   `json:"ends_at,omitempty"`
	ApplicableDays  *string   `json:"applicable_days,omitempty"`
	Terms           *string   `json:"terms,omitempty"`
	TargetAudience  *string   `json:"target_audience,omitempty"`
	Status          string    `json:"status"`
	ClickCount      int64     `json:"click_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type businessEvent struct {
	ID              int64      `json:"id"`
	BusinessID      int64      `json:"business_id"`
	VenueID         *int64     `json:"venue_id,omitempty"`
	Title           string     `json:"title"`
	Description     *string    `json:"description,omitempty"`
	EventType       *string    `json:"event_type,omitempty"`
	StartsAt        *time.Time `json:"starts_at,omitempty"`
	EndsAt          *time.Time `json:"ends_at,omitempty"`
	PriceMin        *float64   `json:"price_min,omitempty"`
	PriceMax        *float64   `json:"price_max,omitempty"`
	BookingRequired bool       `json:"booking_required"`
	TargetAudience  *string    `json:"target_audience,omitempty"`
	Terms           *string    `json:"terms,omitempty"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
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

	if req.TodayUpdate != nil || req.TodayHighlight != nil {
		_, err := s.db.ExecContext(
			r.Context(),
			`INSERT INTO business_dashboard_controls (business_id, today_update, today_highlight)
			 VALUES ($1, NULLIF($2, ''), NULLIF($3, ''))
			 ON CONFLICT (business_id) DO UPDATE
			 SET today_update = COALESCE(NULLIF($2, ''), business_dashboard_controls.today_update),
			     today_highlight = COALESCE(NULLIF($3, ''), business_dashboard_controls.today_highlight),
			     updated_at = CURRENT_TIMESTAMP`,
			currentBusinessID(r),
			strings.TrimSpace(valueOrEmpty(req.TodayUpdate)),
			strings.TrimSpace(valueOrEmpty(req.TodayHighlight)),
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not update business dashboard")
			return
		}
	}

	if hasOfferUpdate(req) {
		if err := s.saveDashboardOffer(r.Context(), currentBusinessID(r), req); err != nil {
			if strings.HasPrefix(err.Error(), "invalid ") || strings.HasPrefix(err.Error(), "offer ") {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "could not save business offer")
			return
		}
	}

	if hasEventUpdate(req) {
		if err := s.saveDashboardEvent(r.Context(), currentBusinessID(r), req); err != nil {
			if strings.HasPrefix(err.Error(), "invalid ") || strings.HasPrefix(err.Error(), "event ") {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeError(w, http.StatusInternalServerError, "could not save business event")
			return
		}
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

	bookings, err := s.getBusinessBookings(ctx, businessID)
	if err != nil {
		return businessDashboardResponse{}, err
	}
	dashboard.Bookings = bookings

	offers, err := s.getBusinessOffers(ctx, businessID)
	if err != nil {
		return businessDashboardResponse{}, err
	}
	dashboard.Offers = offers
	if len(offers) > 0 {
		primary := offers[0]
		dashboard.OfferID = &primary.ID
		dashboard.OfferTitle = &primary.Title
		dashboard.OfferDetails = primary.Description
		dashboard.OfferValidUntil = primary.EndsOn
		dashboard.OfferStatus = primary.Status
		dashboard.OfferClicks = primary.ClickCount
	} else {
		dashboard.OfferTitle = nullableString(offerTitle)
		dashboard.OfferDetails = nullableString(offerDetails)
		dashboard.OfferValidUntil = nullableDateString(offerValidUntil)
	}

	events, err := s.getBusinessEvents(ctx, businessID)
	if err != nil {
		return businessDashboardResponse{}, err
	}
	dashboard.Events = events

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

func hasOfferUpdate(req businessDashboardUpdateRequest) bool {
	return req.OfferID != nil ||
		req.OfferTitle != nil ||
		req.OfferDetails != nil ||
		req.OfferValidUntil != nil ||
		req.OfferStatus != nil
}

func hasEventUpdate(req businessDashboardUpdateRequest) bool {
	return req.EventID != nil ||
		req.EventTitle != nil ||
		req.EventDetails != nil ||
		req.EventType != nil ||
		req.EventStartsAt != nil ||
		req.EventEndsAt != nil ||
		req.EventStatus != nil
}

func (s *Server) saveDashboardOffer(ctx context.Context, businessID int64, req businessDashboardUpdateRequest) error {
	offerStatus := strings.TrimSpace(valueOrEmpty(req.OfferStatus))
	if offerStatus != "" && offerStatus != "draft" && offerStatus != "active" && offerStatus != "paused" && offerStatus != "expired" {
		return errors.New("invalid offer status")
	}

	var offerValidUntil any
	if value := strings.TrimSpace(valueOrEmpty(req.OfferValidUntil)); value != "" {
		parsed, err := time.Parse("2006-01-02", value)
		if err != nil {
			return errors.New("offer valid until must use YYYY-MM-DD")
		}
		offerValidUntil = parsed
	}

	title := strings.TrimSpace(valueOrEmpty(req.OfferTitle))
	description := strings.TrimSpace(valueOrEmpty(req.OfferDetails))
	if req.OfferID != nil && *req.OfferID > 0 {
		result, err := s.db.ExecContext(
			ctx,
			`UPDATE business_offers
			 SET title = COALESCE(NULLIF($3, ''), title),
			     description = COALESCE(NULLIF($4, ''), description),
			     ends_on = COALESCE($5, ends_on),
			     status = COALESCE(NULLIF($6, ''), status),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE id = $1 AND business_id = $2`,
			*req.OfferID,
			businessID,
			title,
			description,
			offerValidUntil,
			offerStatus,
		)
		if err != nil {
			return err
		}
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if rowsAffected == 0 {
			return errors.New("offer not found")
		}
		return nil
	}

	if title == "" {
		return errors.New("offer title is required")
	}
	if offerStatus == "" {
		offerStatus = "active"
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO business_offers (business_id, title, description, ends_on, status)
		 VALUES ($1, $2, NULLIF($3, ''), $4, $5)`,
		businessID,
		title,
		description,
		offerValidUntil,
		offerStatus,
	)
	return err
}

func (s *Server) saveDashboardEvent(ctx context.Context, businessID int64, req businessDashboardUpdateRequest) error {
	eventStatus := strings.TrimSpace(valueOrEmpty(req.EventStatus))
	if eventStatus != "" && eventStatus != "draft" && eventStatus != "scheduled" && eventStatus != "active" && eventStatus != "cancelled" && eventStatus != "completed" {
		return errors.New("invalid event status")
	}

	eventStartsAt, err := parseDashboardTimestamp(valueOrEmpty(req.EventStartsAt), "event starts at")
	if err != nil {
		return err
	}
	eventEndsAt, err := parseDashboardTimestamp(valueOrEmpty(req.EventEndsAt), "event ends at")
	if err != nil {
		return err
	}

	title := strings.TrimSpace(valueOrEmpty(req.EventTitle))
	description := strings.TrimSpace(valueOrEmpty(req.EventDetails))
	eventType := strings.TrimSpace(valueOrEmpty(req.EventType))
	if req.EventID != nil && *req.EventID > 0 {
		result, err := s.db.ExecContext(
			ctx,
			`UPDATE business_events
			 SET title = COALESCE(NULLIF($3, ''), title),
			     description = COALESCE(NULLIF($4, ''), description),
			     event_type = COALESCE(NULLIF($5, ''), event_type),
			     starts_at = COALESCE($6, starts_at),
			     ends_at = COALESCE($7, ends_at),
			     status = COALESCE(NULLIF($8, ''), status),
			     updated_at = CURRENT_TIMESTAMP
			 WHERE id = $1 AND business_id = $2`,
			*req.EventID,
			businessID,
			title,
			description,
			eventType,
			eventStartsAt,
			eventEndsAt,
			eventStatus,
		)
		if err != nil {
			return err
		}
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if rowsAffected == 0 {
			return errors.New("event not found")
		}
		return nil
	}

	if title == "" {
		return errors.New("event title is required")
	}
	if eventStatus == "" {
		eventStatus = "scheduled"
	}

	_, err = s.db.ExecContext(
		ctx,
		`INSERT INTO business_events (business_id, title, description, event_type, starts_at, ends_at, status)
		 VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6, $7)`,
		businessID,
		title,
		description,
		eventType,
		eventStartsAt,
		eventEndsAt,
		eventStatus,
	)
	return err
}

func (s *Server) getBusinessOffers(ctx context.Context, businessID int64) ([]businessOffer, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, business_id, venue_id, title, description, original_price, offer_price,
		        discount_percent, discount_amount, starts_on, ends_on, starts_at::text, ends_at::text,
		        applicable_days, terms, target_audience, status, click_count, created_at, updated_at
		 FROM business_offers
		 WHERE business_id = $1
		 ORDER BY CASE status
		            WHEN 'active' THEN 0
		            WHEN 'draft' THEN 1
		            WHEN 'paused' THEN 2
		            ELSE 3
		          END,
		          COALESCE(ends_on, DATE '9999-12-31') ASC,
		          created_at DESC
		 LIMIT 20`,
		businessID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	offers := make([]businessOffer, 0)
	for rows.Next() {
		var offer businessOffer
		var venueID sql.NullInt64
		var description, startsAt, endsAt, applicableDays, terms, targetAudience sql.NullString
		var originalPrice, offerPrice, discountPercent, discountAmount sql.NullFloat64
		var startsOn, endsOn sql.NullTime
		if err := rows.Scan(
			&offer.ID,
			&offer.BusinessID,
			&venueID,
			&offer.Title,
			&description,
			&originalPrice,
			&offerPrice,
			&discountPercent,
			&discountAmount,
			&startsOn,
			&endsOn,
			&startsAt,
			&endsAt,
			&applicableDays,
			&terms,
			&targetAudience,
			&offer.Status,
			&offer.ClickCount,
			&offer.CreatedAt,
			&offer.UpdatedAt,
		); err != nil {
			return nil, err
		}
		offer.VenueID = nullableInt64(venueID)
		offer.Description = nullableString(description)
		offer.OriginalPrice = nullableFloat64(originalPrice)
		offer.OfferPrice = nullableFloat64(offerPrice)
		offer.DiscountPercent = nullableFloat64(discountPercent)
		offer.DiscountAmount = nullableFloat64(discountAmount)
		offer.StartsOn = nullableDateString(startsOn)
		offer.EndsOn = nullableDateString(endsOn)
		offer.StartsAt = nullableString(startsAt)
		offer.EndsAt = nullableString(endsAt)
		offer.ApplicableDays = nullableString(applicableDays)
		offer.Terms = nullableString(terms)
		offer.TargetAudience = nullableString(targetAudience)
		offers = append(offers, offer)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return offers, nil
}

func (s *Server) getBusinessEvents(ctx context.Context, businessID int64) ([]businessEvent, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT id, business_id, venue_id, title, description, event_type, starts_at, ends_at,
		        price_min, price_max, booking_required, target_audience, terms, status, created_at, updated_at
		 FROM business_events
		 WHERE business_id = $1
		 ORDER BY CASE status
		            WHEN 'active' THEN 0
		            WHEN 'scheduled' THEN 1
		            WHEN 'draft' THEN 2
		            ELSE 3
		          END,
		          COALESCE(starts_at, created_at) ASC
		 LIMIT 20`,
		businessID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]businessEvent, 0)
	for rows.Next() {
		var event businessEvent
		var venueID sql.NullInt64
		var description, eventType, targetAudience, terms sql.NullString
		var startsAt, endsAt sql.NullTime
		var priceMin, priceMax sql.NullFloat64
		if err := rows.Scan(
			&event.ID,
			&event.BusinessID,
			&venueID,
			&event.Title,
			&description,
			&eventType,
			&startsAt,
			&endsAt,
			&priceMin,
			&priceMax,
			&event.BookingRequired,
			&targetAudience,
			&terms,
			&event.Status,
			&event.CreatedAt,
			&event.UpdatedAt,
		); err != nil {
			return nil, err
		}
		event.VenueID = nullableInt64(venueID)
		event.Description = nullableString(description)
		event.EventType = nullableString(eventType)
		event.StartsAt = nullableTimePtr(startsAt)
		event.EndsAt = nullableTimePtr(endsAt)
		event.PriceMin = nullableFloat64(priceMin)
		event.PriceMax = nullableFloat64(priceMax)
		event.TargetAudience = nullableString(targetAudience)
		event.Terms = nullableString(terms)
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

func parseDashboardTimestamp(value string, field string) (any, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}

	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02 15:04"} {
		parsed, err := time.Parse(layout, trimmed)
		if err == nil {
			return parsed, nil
		}
	}

	return nil, errors.New(field + " must use YYYY-MM-DDTHH:MM")
}

func nullableDateString(value sql.NullTime) *string {
	if !value.Valid {
		return nil
	}

	formatted := value.Time.Format("2006-01-02")
	return &formatted
}

func nullableTimeString(value sql.NullTime) *string {
	if !value.Valid {
		return nil
	}

	formatted := value.Time.Format("15:04")
	return &formatted
}

func nullableTimePtr(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}

	return &value.Time
}
