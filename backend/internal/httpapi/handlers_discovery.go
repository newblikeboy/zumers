package httpapi

import (
	"context"
	"database/sql"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type discoverySearchResponse struct {
	Query       string                  `json:"query"`
	Interpreted discoverySearchIntent   `json:"interpreted"`
	Results     []discoverySearchResult `json:"results"`
}

type discoverySearchIntent struct {
	Categories []string `json:"categories"`
	Moods      []string `json:"moods"`
	Services   []string `json:"services"`
	Audiences  []string `json:"audiences"`
	Terms      []string `json:"terms"`
	OpenNow    bool     `json:"open_now"`
	Latitude   *float64 `json:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty"`
	Budget     *float64 `json:"budget,omitempty"`
	GroupSize  *int     `json:"group_size,omitempty"`
	Duration   *int     `json:"duration_minutes,omitempty"`
}

type discoverySearchResult struct {
	ID                     string   `json:"id"`
	ResultType             string   `json:"result_type"`
	BusinessID             int64    `json:"business_id"`
	VenueID                *int64   `json:"venue_id,omitempty"`
	ExperienceID           *int64   `json:"experience_id,omitempty"`
	Title                  string   `json:"title"`
	BusinessName           string   `json:"business_name"`
	Category               string   `json:"category"`
	Subcategory            *string  `json:"subcategory,omitempty"`
	Location               string   `json:"location"`
	City                   *string  `json:"city,omitempty"`
	Area                   *string  `json:"area,omitempty"`
	DistanceKM             *float64 `json:"distance_km,omitempty"`
	OpenNow                bool     `json:"open_now"`
	PriceRange             *string  `json:"price_range,omitempty"`
	StartingPrice          *float64 `json:"starting_price,omitempty"`
	AveragePricePerPerson  *float64 `json:"average_price_per_person,omitempty"`
	TypicalDurationMinutes *int     `json:"typical_duration_minutes,omitempty"`
	MinGroupSize           *int     `json:"min_group_size,omitempty"`
	MaxGroupSize           *int     `json:"max_group_size,omitempty"`
	IndoorOutdoor          *string  `json:"indoor_outdoor,omitempty"`
	Description            *string  `json:"description,omitempty"`
	Tags                   *string  `json:"tags,omitempty"`
	MoodTags               *string  `json:"mood_tags,omitempty"`
	ServiceTags            *string  `json:"service_tags,omitempty"`
	BestFor                *string  `json:"best_for,omitempty"`
	ImageURL               *string  `json:"image_url,omitempty"`
	ActiveOfferTitle       *string  `json:"active_offer_title,omitempty"`
	NextEventTitle         *string  `json:"next_event_title,omitempty"`
	BookingRequired        bool     `json:"booking_required"`
	WalkInAvailable        bool     `json:"walk_in_available"`
	ContactPhone           *string  `json:"contact_phone,omitempty"`
	WhatsappNumber         *string  `json:"whatsapp_number,omitempty"`
	WebsiteURL             *string  `json:"website_url,omitempty"`
	VerificationLevel      string   `json:"verification_level"`
	Score                  float64  `json:"score"`
	Reasons                []string `json:"reasons"`
}

type discoveryCandidate struct {
	result           discoverySearchResult
	latitude         sql.NullFloat64
	longitude        sql.NullFloat64
	searchText       string
	hasVenue         bool
	hasExperience    bool
	hasActiveOffer   bool
	hasUpcomingEvent bool
	onboardingStatus string
	locationVerified bool
}

func (s *Server) handleDiscoverySearch(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	intent := parseDiscoverySearchIntent(r, query)
	limit := pageLimit(r, 20, 50)

	candidates, err := s.loadDiscoveryCandidates(r.Context())
	if err != nil {
		s.logger.Error("discovery search failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not search discovery results")
		return
	}
	openNowByBusiness, err := s.loadDiscoveryOpenNow(r.Context(), candidates)
	if err != nil {
		s.logger.Error("discovery open-now load failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not search discovery results")
		return
	}

	results := make([]discoverySearchResult, 0, len(candidates))
	for _, candidate := range candidates {
		result, ok := scoreDiscoveryCandidate(candidate, intent, openNowByBusiness)
		if !ok {
			continue
		}
		results = append(results, result)
	}

	sort.SliceStable(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})
	if len(results) > limit {
		results = results[:limit]
	}

	writeJSON(w, http.StatusOK, discoverySearchResponse{
		Query:       query,
		Interpreted: intent,
		Results:     results,
	})
}

func (s *Server) loadDiscoveryCandidates(ctx context.Context) ([]discoveryCandidate, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT
		   b.id,
		   b.business_name,
		   b.business_category,
		   b.business_subcategory,
		   b.location,
		   b.city,
		   b.area,
		   b.latitude,
		   b.longitude,
		   b.location_verified,
		   b.verification_level,
		   b.price_range,
		   b.mood_tags,
		   b.service_tags,
		   b.best_for,
		   b.contact_phone,
		   b.whatsapp_number,
		   b.website_url,
		   b.description,
		   b.offerings,
		   b.onboarding_status,
		   v.id,
		   v.venue_name,
		   v.location,
		   v.city,
		   v.area,
		   v.latitude,
		   v.longitude,
		   v.location_verified,
		   ve.id,
		   ve.experience_name,
		   ve.description,
		   ve.category,
		   ve.tags,
		   ve.starting_price,
		   ve.average_price_per_person,
		   ve.typical_duration_minutes,
		   ve.min_group_size,
		   ve.max_group_size,
		   ve.indoor_outdoor,
		   ve.booking_required,
		   ve.walk_in_available,
		   COALESCE((
		     SELECT em.secure_url
		     FROM experience_media em
		     WHERE em.experience_id = ve.id AND em.status = 'active'
		     ORDER BY CASE WHEN em.purpose = 'cover' THEN 0 ELSE 1 END, em.display_order, em.id
		     LIMIT 1
		   ), (
		     SELECT vm.secure_url
		     FROM venue_media vm
		     WHERE vm.venue_id = v.id AND vm.status = 'active'
		     ORDER BY CASE WHEN vm.purpose = 'cover' THEN 0 ELSE 1 END, vm.display_order, vm.id
		     LIMIT 1
		   ), (
		     SELECT bm.secure_url
		     FROM business_media bm
		     WHERE bm.business_id = b.id AND bm.status = 'active'
		     ORDER BY CASE WHEN bm.purpose = 'cover' THEN 0 ELSE 1 END, bm.display_order, bm.id
		     LIMIT 1
		   )) AS image_url,
		   (
		     SELECT bo.title
		     FROM business_offers bo
		     WHERE bo.business_id = b.id
		       AND bo.status = 'active'
		       AND (bo.starts_on IS NULL OR bo.starts_on <= CURRENT_DATE)
		       AND (bo.ends_on IS NULL OR bo.ends_on >= CURRENT_DATE)
		     ORDER BY bo.updated_at DESC
		     LIMIT 1
		   ) AS active_offer_title,
		   (
		     SELECT be.title
		     FROM business_events be
		     WHERE be.business_id = b.id
		       AND be.status IN ('scheduled', 'active')
		       AND (be.ends_at IS NULL OR be.ends_at >= CURRENT_TIMESTAMP)
		     ORDER BY be.starts_at NULLS LAST, be.updated_at DESC
		     LIMIT 1
		   ) AS next_event_title
		 FROM business_accounts b
		 LEFT JOIN business_venues v
		   ON v.business_id = b.id AND v.is_primary = true AND v.status = 'active'
		 LEFT JOIN venue_experiences ve
		   ON ve.venue_id = v.id AND ve.status = 'active'
		 WHERE b.account_status = 'active'
		 ORDER BY b.updated_at DESC, ve.display_order NULLS LAST, ve.id NULLS LAST`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	candidates := make([]discoveryCandidate, 0)
	seenVenueFallback := make(map[int64]struct{})
	for rows.Next() {
		var businessID int64
		var businessName, businessCategory, businessLocation, verificationLevel, onboardingStatus string
		var businessSubcategory, businessCity, businessArea, priceRange, moodTags, serviceTags, bestFor sql.NullString
		var contactPhone, whatsappNumber, websiteURL, businessDescription, offerings sql.NullString
		var businessLatitude, businessLongitude sql.NullFloat64
		var businessLocationVerified bool
		var venueID sql.NullInt64
		var venueName, venueLocation, venueCity, venueArea sql.NullString
		var venueLatitude, venueLongitude sql.NullFloat64
		var venueLocationVerified sql.NullBool
		var experienceID sql.NullInt64
		var experienceName, experienceDescription, experienceCategory, experienceTags, indoorOutdoor sql.NullString
		var startingPrice, averagePrice sql.NullFloat64
		var duration, minGroup, maxGroup sql.NullInt64
		var bookingRequired, walkInAvailable sql.NullBool
		var imageURL, activeOfferTitle, nextEventTitle sql.NullString

		if err := rows.Scan(
			&businessID,
			&businessName,
			&businessCategory,
			&businessSubcategory,
			&businessLocation,
			&businessCity,
			&businessArea,
			&businessLatitude,
			&businessLongitude,
			&businessLocationVerified,
			&verificationLevel,
			&priceRange,
			&moodTags,
			&serviceTags,
			&bestFor,
			&contactPhone,
			&whatsappNumber,
			&websiteURL,
			&businessDescription,
			&offerings,
			&onboardingStatus,
			&venueID,
			&venueName,
			&venueLocation,
			&venueCity,
			&venueArea,
			&venueLatitude,
			&venueLongitude,
			&venueLocationVerified,
			&experienceID,
			&experienceName,
			&experienceDescription,
			&experienceCategory,
			&experienceTags,
			&startingPrice,
			&averagePrice,
			&duration,
			&minGroup,
			&maxGroup,
			&indoorOutdoor,
			&bookingRequired,
			&walkInAvailable,
			&imageURL,
			&activeOfferTitle,
			&nextEventTitle,
		); err != nil {
			return nil, err
		}

		location := businessLocation
		if venueLocation.Valid && strings.TrimSpace(venueLocation.String) != "" {
			location = venueLocation.String
		}
		city := nullableString(businessCity)
		if venueCity.Valid {
			city = &venueCity.String
		}
		area := nullableString(businessArea)
		if venueArea.Valid {
			area = &venueArea.String
		}
		latitude := businessLatitude
		if venueLatitude.Valid {
			latitude = venueLatitude
		}
		longitude := businessLongitude
		if venueLongitude.Valid {
			longitude = venueLongitude
		}
		locationVerified := businessLocationVerified
		if venueLocationVerified.Valid {
			locationVerified = venueLocationVerified.Bool
		}

		title := businessName
		resultType := "venue"
		if experienceName.Valid && strings.TrimSpace(experienceName.String) != "" {
			title = experienceName.String
			resultType = "experience"
		} else if venueName.Valid && strings.TrimSpace(venueName.String) != "" {
			title = venueName.String
		}

		resultID := "business-" + strconv.FormatInt(businessID, 10)
		if experienceID.Valid {
			resultID = "experience-" + strconv.FormatInt(experienceID.Int64, 10)
		} else if venueID.Valid {
			resultID = "venue-" + strconv.FormatInt(venueID.Int64, 10)
			if _, exists := seenVenueFallback[venueID.Int64]; exists {
				continue
			}
			seenVenueFallback[venueID.Int64] = struct{}{}
		}

		result := discoverySearchResult{
			ID:                     resultID,
			ResultType:             resultType,
			BusinessID:             businessID,
			VenueID:                nullableInt64(venueID),
			ExperienceID:           nullableInt64(experienceID),
			Title:                  title,
			BusinessName:           businessName,
			Category:               businessCategory,
			Subcategory:            nullableString(businessSubcategory),
			Location:               location,
			City:                   city,
			Area:                   area,
			PriceRange:             nullableString(priceRange),
			StartingPrice:          nullableFloat64(startingPrice),
			AveragePricePerPerson:  nullableFloat64(averagePrice),
			TypicalDurationMinutes: nullableInt(duration),
			MinGroupSize:           nullableInt(minGroup),
			MaxGroupSize:           nullableInt(maxGroup),
			IndoorOutdoor:          nullableString(indoorOutdoor),
			Description:            nullableString(experienceDescription),
			Tags:                   nullableString(experienceTags),
			MoodTags:               nullableString(moodTags),
			ServiceTags:            nullableString(serviceTags),
			BestFor:                nullableString(bestFor),
			ImageURL:               nullableString(imageURL),
			ActiveOfferTitle:       nullableString(activeOfferTitle),
			NextEventTitle:         nullableString(nextEventTitle),
			BookingRequired:        bookingRequired.Valid && bookingRequired.Bool,
			WalkInAvailable:        !bookingRequired.Valid || walkInAvailable.Bool,
			ContactPhone:           nullableString(contactPhone),
			WhatsappNumber:         nullableString(whatsappNumber),
			WebsiteURL:             nullableString(websiteURL),
			VerificationLevel:      verificationLevel,
		}
		if result.Description == nil {
			result.Description = nullableString(businessDescription)
		}
		if result.Description == nil {
			result.Description = nullableString(offerings)
		}

		searchText := strings.ToLower(strings.Join([]string{
			result.Title,
			result.BusinessName,
			result.Category,
			valueOrEmpty(result.Subcategory),
			result.Location,
			valueOrEmpty(result.City),
			valueOrEmpty(result.Area),
			valueOrEmpty(result.Description),
			valueOrEmpty(result.Tags),
			valueOrEmpty(result.MoodTags),
			valueOrEmpty(result.ServiceTags),
			valueOrEmpty(result.BestFor),
			valueOrEmpty(result.ActiveOfferTitle),
			valueOrEmpty(result.NextEventTitle),
		}, " "))

		candidates = append(candidates, discoveryCandidate{
			result:           result,
			latitude:         latitude,
			longitude:        longitude,
			searchText:       searchText,
			hasVenue:         venueID.Valid,
			hasExperience:    experienceID.Valid,
			hasActiveOffer:   activeOfferTitle.Valid,
			hasUpcomingEvent: nextEventTitle.Valid,
			onboardingStatus: onboardingStatus,
			locationVerified: locationVerified,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return candidates, nil
}

func (s *Server) loadDiscoveryOpenNow(ctx context.Context, candidates []discoveryCandidate) (map[int64]bool, error) {
	ids := make([]int64, 0)
	seen := make(map[int64]struct{})
	for _, candidate := range candidates {
		id := candidate.result.BusinessID
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	openNow := make(map[int64]bool, len(ids))
	if len(ids) == 0 {
		return openNow, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for index, id := range ids {
		placeholders[index] = "$" + strconv.Itoa(index+1)
		args[index] = id
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT business_id, weekday, interval_order, is_closed, opens_at, closes_at
		 FROM business_opening_hours
		 WHERE business_id IN (`+strings.Join(placeholders, ",")+`)
		 ORDER BY business_id, weekday, interval_order`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	schedules := make(map[int64][]businessOpeningHourResponse, len(ids))
	for rows.Next() {
		var businessID int64
		var item businessOpeningHourResponse
		var opensAt, closesAt sql.NullString
		if err := rows.Scan(
			&businessID,
			&item.Weekday,
			&item.IntervalOrder,
			&item.IsClosed,
			&opensAt,
			&closesAt,
		); err != nil {
			return nil, err
		}
		item.OpensAt = nullableString(opensAt)
		item.ClosesAt = nullableString(closesAt)
		schedules[businessID] = append(schedules[businessID], item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	now := time.Now()
	for _, id := range ids {
		openNow[id] = businessIsOpenNow(schedules[id], now)
	}

	return openNow, nil
}

func scoreDiscoveryCandidate(candidate discoveryCandidate, intent discoverySearchIntent, openNowByBusiness map[int64]bool) (discoverySearchResult, bool) {
	result := candidate.result
	score := 10.0
	reasons := make([]string, 0, 6)
	queryPresent := len(intent.Terms) > 0 || strings.TrimSpace(intentQueryText(intent)) != ""

	if candidate.hasExperience {
		score += 12
		reasons = append(reasons, "Has a specific experience")
	}
	if candidate.onboardingStatus == "approved" || candidate.onboardingStatus == "submitted" {
		score += 4
	}
	if candidate.locationVerified {
		score += 4
		reasons = append(reasons, "Location details available")
	}
	if result.ImageURL != nil {
		score += 2
	}
	if candidate.hasActiveOffer {
		score += 8
		reasons = append(reasons, "Live offer available")
	}
	if candidate.hasUpcomingEvent {
		score += 8
		reasons = append(reasons, "Upcoming event")
	}

	if len(intent.Categories) > 0 {
		if discoveryTextMatchesAny(candidate.searchText, intent.Categories) ||
			discoveryTextMatchesAny(candidate.searchText, intent.Terms) {
			score += 24
			reasons = append(reasons, "Matches the activity type")
		} else {
			return result, false
		}
	}
	strictTerms := discoveryStrictTerms(intent)
	if len(strictTerms) > 0 {
		if discoveryTextMatchesAny(candidate.searchText, strictTerms) {
			score += 18
			reasons = append(reasons, "Matches the exact search")
		} else {
			return result, false
		}
	}
	if len(intent.Moods) > 0 {
		if discoveryTextMatchesAny(candidate.searchText, intent.Moods) {
			score += 14
			reasons = append(reasons, "Matches the mood")
		} else {
			score -= 4
		}
	}
	if len(intent.Services) > 0 {
		if discoveryTextMatchesAny(candidate.searchText, intent.Services) {
			score += 12
			reasons = append(reasons, "Matches the plan")
		} else {
			score -= 4
		}
	}
	if len(intent.Audiences) > 0 && discoveryTextMatchesAny(candidate.searchText, intent.Audiences) {
		score += 8
		reasons = append(reasons, "Good audience fit")
	}

	result.OpenNow = openNowByBusiness[result.BusinessID]
	if intent.OpenNow {
		if result.OpenNow {
			score += 18
			reasons = append(reasons, "Open now")
		} else {
			score -= 20
		}
	} else if result.OpenNow {
		score += 3
	}

	if intent.Latitude != nil && intent.Longitude != nil && candidate.latitude.Valid && candidate.longitude.Valid {
		distance := haversineKM(*intent.Latitude, *intent.Longitude, candidate.latitude.Float64, candidate.longitude.Float64)
		rounded := math.Round(distance*10) / 10
		result.DistanceKM = &rounded
		switch {
		case distance <= 2:
			score += 18
			reasons = append(reasons, "Very nearby")
		case distance <= 5:
			score += 12
			reasons = append(reasons, "Nearby")
		case distance <= 10:
			score += 6
		case distance > 25:
			score -= 10
		}
	}

	if intent.Budget != nil {
		price := discoveryComparablePrice(result)
		if price > 0 {
			total := price
			if intent.GroupSize != nil && *intent.GroupSize > 1 && discoveryBudgetLooksTotal(intent) {
				total = price * float64(*intent.GroupSize)
			}
			if total <= *intent.Budget {
				score += 14
				reasons = append(reasons, "Fits budget")
			} else if total > *intent.Budget*1.5 {
				score -= 10
			}
		}
	}

	if intent.GroupSize != nil && *intent.GroupSize > 0 {
		if result.MinGroupSize != nil && *intent.GroupSize < *result.MinGroupSize {
			score -= 6
		}
		if result.MaxGroupSize != nil && *result.MaxGroupSize > 0 && *intent.GroupSize > *result.MaxGroupSize {
			score -= 8
		}
		if result.MinGroupSize != nil || result.MaxGroupSize != nil {
			reasons = append(reasons, "Group size info available")
		}
	}

	if intent.Duration != nil && result.TypicalDurationMinutes != nil {
		diff := math.Abs(float64(*intent.Duration - *result.TypicalDurationMinutes))
		if diff <= 45 {
			score += 8
			reasons = append(reasons, "Fits your time")
		} else if diff > 120 {
			score -= 5
		}
	}

	freeTerms := discoveryFreeTerms(intent)
	for _, term := range freeTerms {
		if strings.Contains(candidate.searchText, term) {
			score += 6
			reasons = append(reasons, "Matches \""+term+"\"")
		}
	}

	if queryPresent && score < 12 {
		return result, false
	}
	result.Score = math.Round(score*10) / 10
	result.Reasons = compactDiscoveryReasons(reasons)
	if len(result.Reasons) == 0 {
		result.Reasons = append(result.Reasons, "Relevant nearby option")
	}

	return result, true
}

func parseDiscoverySearchIntent(r *http.Request, query string) discoverySearchIntent {
	combined := strings.ToLower(strings.TrimSpace(query + " " + r.URL.Query().Get("chips")))
	intent := discoverySearchIntent{
		Categories: make([]string, 0),
		Moods:      make([]string, 0),
		Services:   make([]string, 0),
		Audiences:  make([]string, 0),
		Terms:      discoverySearchTerms(query),
	}

	intent.Categories = appendMatches(intent.Categories, combined, map[string][]string{
		"Street food":              {"street food", "momos", "chaat", "golgappe", "roll", "snack", "spicy"},
		"Restaurant or cafe":       {"restaurant", "cafe", "coffee", "dinner", "lunch", "breakfast", "date cafe", "food"},
		"Fun and entertainment":    {"fun", "bowling", "arcade", "gaming", "movie", "cinema", "karaoke", "escape"},
		"Adventure":                {"adventure", "go kart", "karting", "paintball", "trampoline", "trek", "camp"},
		"Nightlife":                {"night", "club", "pub", "bar", "dj", "party", "late night"},
		"Culture and events":       {"event", "concert", "workshop", "festival", "standup", "stand-up", "museum", "theatre"},
		"Sports and fitness":       {"sport", "turf", "cricket", "football", "badminton", "swimming", "gym", "fitness"},
		"Relax and explore":        {"peaceful", "relax", "park", "garden", "lake", "resort", "picnic"},
		"Travel or transport":      {"travel", "trip", "tour", "ride", "cab", "bike rental"},
		"Attractions and heritage": {"monument", "heritage", "temple", "photo spot", "attraction"},
		"Shopping and markets":     {"shopping", "market", "mall", "flea", "books"},
		"Wellness and self care":   {"spa", "salon", "massage", "wellness", "self care"},
		"Learning and hobbies":     {"class", "hobby", "learn", "art", "dance", "music", "cooking", "pottery"},
	})
	intent.Moods = appendMatches(intent.Moods, combined, map[string][]string{
		"chill":      {"chill", "relax"},
		"fun":        {"fun", "friends"},
		"adventure":  {"adventure"},
		"romantic":   {"romantic", "date", "couple"},
		"party":      {"party", "club", "dj"},
		"peaceful":   {"peaceful", "quiet"},
		"premium":    {"premium", "luxury", "fine dining"},
		"foodie":     {"foodie", "food", "hungry"},
		"late-night": {"late night", "tonight"},
	})
	intent.Services = appendMatches(intent.Services, combined, map[string][]string{
		"breakfast":            {"breakfast"},
		"lunch":                {"lunch"},
		"dinner":               {"dinner"},
		"coffee":               {"coffee"},
		"live-music":           {"live music"},
		"birthday-celebration": {"birthday"},
		"quick-bite":           {"quick bite", "snack"},
		"food-walk":            {"food walk"},
		"booking":              {"booking", "reserve"},
		"walk-in":              {"walk in", "walk-in"},
	})
	intent.Audiences = appendMatches(intent.Audiences, combined, map[string][]string{
		"friends":          {"friends", "group"},
		"couples":          {"couple", "date"},
		"family":           {"family"},
		"kids":             {"kids", "children"},
		"solo":             {"solo", "alone"},
		"large-groups":     {"large group"},
		"college-students": {"college"},
		"office-groups":    {"office", "team"},
	})

	intent.OpenNow = strings.Contains(combined, "open now") ||
		strings.Contains(combined, "right now") ||
		strings.Contains(combined, "nearby now")
	intent.Latitude = queryFloat(r, "latitude")
	intent.Longitude = queryFloat(r, "longitude")
	intent.Budget = parseDiscoveryBudget(combined)
	intent.GroupSize = parseDiscoveryGroupSize(combined)
	intent.Duration = parseDiscoveryDuration(combined)

	return intent
}

func appendMatches(values []string, text string, patterns map[string][]string) []string {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		seen[value] = struct{}{}
	}
	for value, needles := range patterns {
		for _, needle := range needles {
			if strings.Contains(text, needle) {
				if _, exists := seen[value]; !exists {
					values = append(values, value)
					seen[value] = struct{}{}
				}
				break
			}
		}
	}
	return values
}

func queryFloat(r *http.Request, key string) *float64 {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return nil
	}
	return &value
}

func parseDiscoveryBudget(text string) *float64 {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?:under|below|budget|rs|₹|in)\s*([0-9][0-9,]*)`),
		regexp.MustCompile(`([0-9][0-9,]*)\s*(?:rs|₹|rupees)`),
	}
	for _, pattern := range patterns {
		match := pattern.FindStringSubmatch(text)
		if len(match) < 2 {
			continue
		}
		value, err := strconv.ParseFloat(strings.ReplaceAll(match[1], ",", ""), 64)
		if err == nil && value > 0 {
			return &value
		}
	}
	return nil
}

func parseDiscoveryGroupSize(text string) *int {
	pattern := regexp.MustCompile(`([0-9]+)\s*(?:people|person|friends|friend|members|member|pax)`)
	match := pattern.FindStringSubmatch(text)
	if len(match) < 2 {
		return nil
	}
	value, err := strconv.Atoi(match[1])
	if err != nil || value <= 0 {
		return nil
	}
	return &value
}

func parseDiscoveryDuration(text string) *int {
	hourPattern := regexp.MustCompile(`([0-9]+)\s*(?:hour|hours|hr|hrs)`)
	if match := hourPattern.FindStringSubmatch(text); len(match) >= 2 {
		value, err := strconv.Atoi(match[1])
		if err == nil && value > 0 {
			minutes := value * 60
			return &minutes
		}
	}
	minPattern := regexp.MustCompile(`([0-9]+)\s*(?:minute|minutes|min|mins)`)
	if match := minPattern.FindStringSubmatch(text); len(match) >= 2 {
		value, err := strconv.Atoi(match[1])
		if err == nil && value > 0 {
			return &value
		}
	}
	return nil
}

func discoveryTextMatchesAny(text string, values []string) bool {
	for _, value := range values {
		normalized := strings.ToLower(strings.ReplaceAll(value, "-", " "))
		if strings.Contains(text, normalized) || strings.Contains(text, strings.ToLower(value)) {
			return true
		}
	}
	return false
}

func discoveryComparablePrice(result discoverySearchResult) float64 {
	if result.AveragePricePerPerson != nil {
		return *result.AveragePricePerPerson
	}
	if result.StartingPrice != nil {
		return *result.StartingPrice
	}
	switch valueOrEmpty(result.PriceRange) {
	case "budget":
		return 300
	case "moderate":
		return 800
	case "premium":
		return 1800
	case "luxury":
		return 3500
	default:
		return 0
	}
}

func discoveryBudgetLooksTotal(intent discoverySearchIntent) bool {
	return intent.GroupSize != nil && intent.Budget != nil && *intent.Budget >= 500
}

func haversineKM(lat1 float64, lon1 float64, lat2 float64, lon2 float64) float64 {
	const earthRadiusKM = 6371.0
	toRad := func(value float64) float64 { return value * math.Pi / 180 }
	dLat := toRad(lat2 - lat1)
	dLon := toRad(lon2 - lon1)
	rLat1 := toRad(lat1)
	rLat2 := toRad(lat2)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rLat1)*math.Cos(rLat2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return earthRadiusKM * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func compactDiscoveryReasons(reasons []string) []string {
	seen := make(map[string]struct{}, len(reasons))
	compacted := make([]string, 0, 4)
	for _, reason := range reasons {
		reason = strings.TrimSpace(reason)
		if reason == "" {
			continue
		}
		if _, exists := seen[reason]; exists {
			continue
		}
		seen[reason] = struct{}{}
		compacted = append(compacted, reason)
		if len(compacted) >= 4 {
			break
		}
	}
	return compacted
}

func intentQueryText(intent discoverySearchIntent) string {
	return strings.Join(append(append(append([]string{}, intent.Categories...), intent.Moods...), intent.Services...), " ")
}

func discoveryFreeTerms(intent discoverySearchIntent) []string {
	terms := make([]string, 0)
	for _, value := range intent.Terms {
		value = strings.Trim(value, ".,!?")
		if len(value) >= 4 {
			terms = append(terms, value)
		}
	}
	return terms
}

func discoveryStrictTerms(intent discoverySearchIntent) []string {
	genericTerms := map[string]struct{}{
		"date": {}, "family": {}, "food": {}, "friend": {}, "friends": {}, "fun": {}, "nearby": {},
		"night": {}, "open": {}, "party": {}, "peaceful": {}, "relax": {}, "tonight": {},
	}
	terms := make([]string, 0, len(intent.Terms))
	for _, term := range intent.Terms {
		term = strings.TrimSpace(strings.ToLower(term))
		if term == "" {
			continue
		}
		if _, err := strconv.Atoi(term); err == nil {
			continue
		}
		if _, generic := genericTerms[term]; generic {
			continue
		}
		terms = append(terms, term)
	}
	return terms
}

func discoverySearchTerms(query string) []string {
	stopWords := map[string]struct{}{
		"a": {}, "an": {}, "and": {}, "are": {}, "can": {}, "do": {}, "for": {}, "in": {}, "is": {},
		"me": {}, "near": {}, "nearby": {}, "of": {}, "on": {}, "or": {}, "the": {}, "to": {}, "under": {},
		"we": {}, "what": {}, "with": {},
	}
	seen := make(map[string]struct{})
	terms := make([]string, 0)
	for _, value := range strings.Fields(strings.ToLower(query)) {
		value = strings.Trim(value, ".,!?₹")
		if len(value) < 3 {
			continue
		}
		if _, stop := stopWords[value]; stop {
			continue
		}
		if _, duplicate := seen[value]; duplicate {
			continue
		}
		seen[value] = struct{}{}
		terms = append(terms, value)
	}
	return terms
}
