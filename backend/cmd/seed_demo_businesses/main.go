package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math"
	"net/url"
	"strings"
	"time"

	"zumers/backend/internal/config"
	"zumers/backend/internal/database"
	"zumers/backend/internal/security"
)

const demoPassword = "Demo@12345"

type taxonomyCategory struct {
	Slug          string
	Name          string
	Subcategories []taxonomySubcategory
}

type taxonomySubcategory struct {
	Slug string
	Name string
}

type locationTemplate struct {
	Area       string
	City       string
	District   string
	PostalCode string
	Latitude   float64
	Longitude  float64
}

type seededBusiness struct {
	BusinessID int64
	VenueID    int64
	Email      string
	Name       string
	Category   string
}

var demoLocations = []locationTemplate{
	{Area: "Rajouri Garden", City: "New Delhi", District: "West Delhi", PostalCode: "110027", Latitude: 28.6427, Longitude: 77.1209},
	{Area: "Hauz Khas", City: "New Delhi", District: "South Delhi", PostalCode: "110016", Latitude: 28.5494, Longitude: 77.2001},
	{Area: "Cyber Hub", City: "Gurugram", District: "Gurugram", PostalCode: "122002", Latitude: 28.4950, Longitude: 77.0888},
	{Area: "Sector 18", City: "Noida", District: "Gautam Buddha Nagar", PostalCode: "201301", Latitude: 28.5708, Longitude: 77.3261},
	{Area: "Connaught Place", City: "New Delhi", District: "Central Delhi", PostalCode: "110001", Latitude: 28.6315, Longitude: 77.2167},
}

var demoNames = map[string][]string{
	"street-food":              {"Dilli Chaat Junction", "Momo Chowk Express", "Tandoor Tikka Cart", "Paratha Lane Co.", "Golgappa Social"},
	"restaurant-or-cafe":       {"Katori House Cafe", "Rooftop Bean Co.", "The Family Table", "Biryani Courtyard", "Dessert Room Delhi"},
	"fun-and-entertainment":    {"Level Up Arcade", "Strike Zone Bowling", "Pixel Play Arena", "Escape Hour Studio", "Karaoke Social Club"},
	"adventure":                {"SkyTrail Adventure Park", "GoKart Grid", "Trampoline Republic", "RockRush Climbing", "Paintball Basecamp"},
	"nightlife":                {"Afterhours Lounge", "Neon Deck Brewery", "Skyline DJ Bar", "The Sports Screen", "Moonlit Rooftop"},
	"culture-and-events":       {"Canvas Culture Studio", "Theatre House Delhi", "Open Mic Yard", "Heritage Walk Collective", "Festival Courtyard"},
	"sports-and-fitness":       {"Turf Time Arena", "Smash Badminton Club", "AquaFit Swim Studio", "Goalpost Football Turf", "Core Yoga Loft"},
	"relax-and-explore":        {"Garden Pause Cafe", "Lakeside Picnic Spot", "Quiet Trails Retreat", "Sunset Viewpoint", "Urban Resort Daypass"},
	"attractions-and-heritage": {"Delhi Heritage Point", "Monument Trail Hub", "Temple Walks India", "Photo Spot Studio", "Science Day Out"},
	"shopping-and-markets":     {"Bazaar Street Market", "Weekend Flea Yard", "Craft Lane Collective", "Book Market Corner", "Night Market Delhi"},
	"wellness-and-self-care":   {"Calm Spa Studio", "Glow Salon Lounge", "Ayurveda Rest House", "Mindful Yoga Space", "Recovery Room"},
	"learning-and-hobbies":     {"Art Hour Studio", "Dance Lab Delhi", "Music Room Collective", "Pottery Wheel Cafe", "Cooking Class Table"},
	"travel-or-transport":      {"Weekend Trip Co.", "City Tour Desk", "Ride Ready Rentals", "Himalayan Camps Desk", "Local Guide Delhi"},
	"other-local-service":      {"Celebration Planner Co.", "Frame Story Photography", "Party Decor Lab", "Community Hall Studio", "Gear Rental Desk"},
}

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	db, err := database.OpenPostgres(ctx, cfg.Postgres)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	categories, err := loadTaxonomy(ctx, db)
	if err != nil {
		log.Fatal(err)
	}
	if len(categories) == 0 {
		log.Fatal("no active business taxonomy categories found; run migrations first")
	}

	passwordHash, err := security.HashPassword(demoPassword)
	if err != nil {
		log.Fatal(err)
	}

	seeded := make([]seededBusiness, 0, len(categories)*5)
	for categoryIndex, category := range categories {
		if len(category.Subcategories) == 0 {
			returnFatal(fmt.Errorf("category %q has no active subcategories", category.Name))
		}
		for i := 0; i < 5; i++ {
			email := demoEmail(category, i)
			if existing, name, err := existingDemoBusiness(ctx, db, email); err != nil {
				log.Fatal(err)
			} else if existing {
				seeded = append(seeded, seededBusiness{
					Email:    email,
					Name:     name,
					Category: category.Name,
				})
				fmt.Printf("Already %02d/%02d: %s | %s\n", len(seeded), len(categories)*5, category.Name, name)
				continue
			}
			tx, err := db.BeginTx(ctx, nil)
			if err != nil {
				log.Fatal(err)
			}
			item, err := seedBusiness(ctx, tx, category, categoryIndex, i, passwordHash)
			if err != nil {
				_ = tx.Rollback()
				log.Fatal(err)
			}
			if err := tx.Commit(); err != nil {
				log.Fatal(err)
			}
			seeded = append(seeded, item)
			fmt.Printf("Seeded %02d/%02d: %s | %s\n", len(seeded), len(categories)*5, category.Name, item.Name)
		}
	}

	fmt.Printf("Seeded %d complete demo businesses across %d categories.\n", len(seeded), len(categories))
	fmt.Printf("Business login password for all demo accounts: %s\n", demoPassword)
	if err := printAudit(ctx, db); err != nil {
		log.Fatal(err)
	}
	for _, item := range seeded {
		fmt.Printf("- %s | %s | %s\n", item.Category, item.Name, item.Email)
	}
}

func loadTaxonomy(ctx context.Context, db *sql.DB) ([]taxonomyCategory, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT c.slug, c.name, s.slug, s.name
		 FROM business_categories c
		 JOIN business_subcategories s ON s.category_id = c.id AND s.active = true
		 WHERE c.active = true
		 ORDER BY c.display_order, c.name, s.display_order, s.name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]taxonomyCategory, 0)
	indexes := make(map[string]int)
	for rows.Next() {
		var categorySlug, categoryName, subcategorySlug, subcategoryName string
		if err := rows.Scan(&categorySlug, &categoryName, &subcategorySlug, &subcategoryName); err != nil {
			return nil, err
		}
		index, exists := indexes[categorySlug]
		if !exists {
			categories = append(categories, taxonomyCategory{
				Slug:          categorySlug,
				Name:          categoryName,
				Subcategories: make([]taxonomySubcategory, 0),
			})
			index = len(categories) - 1
			indexes[categorySlug] = index
		}
		categories[index].Subcategories = append(categories[index].Subcategories, taxonomySubcategory{
			Slug: subcategorySlug,
			Name: subcategoryName,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return categories, nil
}

func seedBusiness(ctx context.Context, tx *sql.Tx, category taxonomyCategory, categoryIndex int, itemIndex int, passwordHash string) (seededBusiness, error) {
	subcategory := category.Subcategories[itemIndex%len(category.Subcategories)]
	location := demoLocations[(categoryIndex+itemIndex)%len(demoLocations)]
	name := businessName(category, itemIndex, subcategory)
	slug := demoSlug(category, itemIndex)
	email := demoEmail(category, itemIndex)
	lat := location.Latitude + float64(categoryIndex)*0.002 + float64(itemIndex)*0.0007
	lon := location.Longitude + float64(categoryIndex)*0.0017 - float64(itemIndex)*0.0006
	priceRange := []string{"budget", "moderate", "premium", "moderate", "budget"}[itemIndex%5]
	verification := []string{"zumers_verified", "ownership_verified", "location_verified", "phone_verified", "location_verified"}[itemIndex%5]
	publicPhone := fmt.Sprintf("+9198%02d%02d%04d", categoryIndex+10, itemIndex+11, 1000+(categoryIndex*13)+itemIndex)
	description := fmt.Sprintf("%s is a realistic demo profile for %s plans around %s, built to test Zumers discovery, onboarding, offers, events, media, and booking flows.", name, strings.ToLower(category.Name), location.Area)
	offerings := fmt.Sprintf("%s, signature %s experience, group-friendly packages, walk-in support, and weekend specials.", subcategory.Name, strings.ToLower(category.Name))
	openingSummary := "Mon-Sun, 10:00 AM - 11:30 PM"
	address := fmt.Sprintf("Shop %d, %s Market Road, %s", 20+categoryIndex+itemIndex, location.Area, location.City)
	googlePlaceID := fmt.Sprintf("demo_%s_%d", slug, categoryIndex+itemIndex+1)

	var businessID int64
	err := tx.QueryRowContext(
		ctx,
		`INSERT INTO business_accounts (
		   email, password_hash, business_name, business_category, business_subcategory,
		   location, contact_phone, description, offerings, opening_hours,
		   onboarding_status, account_status, address, city, area, postal_code,
		   latitude, longitude, service_radius_km, price_range, mood_tags, service_tags,
		   best_for, website_url, whatsapp_number, google_place_id, state, country,
		   district, landmark, location_accuracy_meters, location_verified, facility_tags,
		   verification_level, created_at, updated_at
		 )
		 VALUES (
		   $1, $2, $3, $4, $5,
		   $6, $7, $8, $9, $10,
		   'approved', 'active', $11, $12, $13, $14,
		   $15, $16, $17, $18, $19, $20,
		   $21, $22, $23, $24, 'Delhi NCR', 'India',
		   $25, $26, 18.5, true, $27,
		   $28, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		 )
		 ON CONFLICT (email) DO UPDATE SET
		   password_hash = EXCLUDED.password_hash,
		   business_name = EXCLUDED.business_name,
		   business_category = EXCLUDED.business_category,
		   business_subcategory = EXCLUDED.business_subcategory,
		   location = EXCLUDED.location,
		   contact_phone = EXCLUDED.contact_phone,
		   description = EXCLUDED.description,
		   offerings = EXCLUDED.offerings,
		   opening_hours = EXCLUDED.opening_hours,
		   onboarding_status = EXCLUDED.onboarding_status,
		   account_status = EXCLUDED.account_status,
		   address = EXCLUDED.address,
		   city = EXCLUDED.city,
		   area = EXCLUDED.area,
		   postal_code = EXCLUDED.postal_code,
		   latitude = EXCLUDED.latitude,
		   longitude = EXCLUDED.longitude,
		   service_radius_km = EXCLUDED.service_radius_km,
		   price_range = EXCLUDED.price_range,
		   mood_tags = EXCLUDED.mood_tags,
		   service_tags = EXCLUDED.service_tags,
		   best_for = EXCLUDED.best_for,
		   website_url = EXCLUDED.website_url,
		   whatsapp_number = EXCLUDED.whatsapp_number,
		   google_place_id = EXCLUDED.google_place_id,
		   state = EXCLUDED.state,
		   country = EXCLUDED.country,
		   district = EXCLUDED.district,
		   landmark = EXCLUDED.landmark,
		   location_accuracy_meters = EXCLUDED.location_accuracy_meters,
		   location_verified = EXCLUDED.location_verified,
		   facility_tags = EXCLUDED.facility_tags,
		   verification_level = EXCLUDED.verification_level,
		   updated_at = CURRENT_TIMESTAMP
		 RETURNING id`,
		email,
		passwordHash,
		name,
		category.Name,
		subcategory.Name,
		location.Area+", "+location.City,
		publicPhone,
		description,
		offerings,
		openingSummary,
		address,
		location.City,
		location.Area,
		location.PostalCode,
		lat,
		lon,
		8.0+float64(itemIndex),
		priceRange,
		moodTags(category.Slug),
		serviceTags(category.Slug),
		bestFor(category.Slug),
		"https://business.zumers.in/demo/"+slug,
		publicPhone,
		googlePlaceID,
		location.District,
		location.Area+" Metro Gate "+fmt.Sprint(itemIndex+1),
		facilityTags(category.Slug),
		verification,
	).Scan(&businessID)
	if err != nil {
		return seededBusiness{}, err
	}

	venueID, err := upsertVenue(ctx, tx, businessID, name, location, address, lat, lon, googlePlaceID, openingSummary, verification)
	if err != nil {
		return seededBusiness{}, err
	}
	if err := seedOpeningHours(ctx, tx, businessID, category.Slug); err != nil {
		return seededBusiness{}, err
	}
	if err := seedExperiences(ctx, tx, venueID, category, subcategory, itemIndex); err != nil {
		return seededBusiness{}, err
	}
	if err := seedMedia(ctx, tx, businessID, venueID, category, subcategory, slug, name); err != nil {
		return seededBusiness{}, err
	}
	if err := seedDashboardAndActivity(ctx, tx, businessID, venueID, category, subcategory, itemIndex); err != nil {
		return seededBusiness{}, err
	}

	return seededBusiness{
		BusinessID: businessID,
		VenueID:    venueID,
		Email:      email,
		Name:       name,
		Category:   category.Name,
	}, nil
}

func upsertVenue(ctx context.Context, tx *sql.Tx, businessID int64, name string, location locationTemplate, address string, lat float64, lon float64, googlePlaceID string, openingSummary string, verification string) (int64, error) {
	var venueID int64
	err := tx.QueryRowContext(
		ctx,
		`INSERT INTO business_venues (
		   business_id, venue_name, is_primary, location, address, city, area, postal_code,
		   google_place_id, state, country, district, landmark, latitude, longitude,
		   location_accuracy_meters, location_verified, service_radius_km, opening_hours,
		   status, verification_level, created_at, updated_at
		 )
		 VALUES (
		   $1, $2, true, $3, $4, $5, $6, $7,
		   $8, 'Delhi NCR', 'India', $9, $10, $11, $12,
		   18.5, true, 8.0, $13, 'active', $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		 )
		 ON CONFLICT (business_id) WHERE is_primary = true DO UPDATE SET
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
		   service_radius_km = EXCLUDED.service_radius_km,
		   opening_hours = EXCLUDED.opening_hours,
		   status = EXCLUDED.status,
		   verification_level = EXCLUDED.verification_level,
		   updated_at = CURRENT_TIMESTAMP
		 RETURNING id`,
		businessID,
		name,
		location.Area+", "+location.City,
		address,
		location.City,
		location.Area,
		location.PostalCode,
		googlePlaceID,
		location.District,
		location.Area+" Metro Gate",
		lat,
		lon,
		openingSummary,
		verification,
	).Scan(&venueID)
	return venueID, err
}

func seedOpeningHours(ctx context.Context, tx *sql.Tx, businessID int64, categorySlug string) error {
	openAt, closeAt := "10:00", "23:30"
	if categorySlug == "nightlife" {
		openAt, closeAt = "18:00", "02:00"
	}
	if categorySlug == "street-food" {
		openAt, closeAt = "08:00", "23:45"
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM business_opening_hours WHERE business_id = $1`, businessID); err != nil {
		return err
	}
	for weekday := 0; weekday <= 6; weekday++ {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO business_opening_hours (business_id, weekday, interval_order, is_closed, opens_at, closes_at)
			 VALUES ($1, $2, 1, false, $3, $4)`,
			businessID,
			weekday,
			openAt,
			closeAt,
		); err != nil {
			return err
		}
	}
	return nil
}

func seedExperiences(ctx context.Context, tx *sql.Tx, venueID int64, category taxonomyCategory, subcategory taxonomySubcategory, itemIndex int) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM venue_experiences WHERE venue_id = $1`, venueID); err != nil {
		return err
	}
	experiences := []string{
		subcategory.Name,
		"Signature " + subcategory.Name + " Plan",
	}
	for index, name := range experiences {
		price := float64(250 + itemIndex*150 + index*120)
		duration := 45 + itemIndex*20 + index*30
		minGroup := 1
		maxGroup := 8 + itemIndex*2
		if category.Slug == "travel-or-transport" || category.Slug == "adventure" {
			duration += 120
			maxGroup += 10
		}
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO venue_experiences (
			   venue_id, experience_name, description, category, tags,
			   starting_price, average_price_per_person, typical_duration_minutes,
			   min_group_size, ideal_group_size, max_group_size, indoor_outdoor,
			   booking_required, walk_in_available, display_order, status
			 )
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14, 'active')`,
			venueID,
			name,
			fmt.Sprintf("Demo %s experience for testing Zumers discovery ranking, budget, duration, and group-size matching.", strings.ToLower(name)),
			category.Name,
			moodTags(category.Slug)+", "+serviceTags(category.Slug),
			math.Max(99, price-80),
			price,
			duration,
			minGroup,
			4+itemIndex,
			maxGroup,
			indoorOutdoor(category.Slug),
			category.Slug == "travel-or-transport" || category.Slug == "adventure" || category.Slug == "culture-and-events",
			index,
		); err != nil {
			return err
		}
	}
	return nil
}

func seedMedia(ctx context.Context, tx *sql.Tx, businessID int64, venueID int64, category taxonomyCategory, subcategory taxonomySubcategory, slug string, name string) error {
	imageURL := "https://placehold.co/1200x800/0f766e/ffffff?text=" + url.QueryEscape(name)
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO business_media (business_id, media_type, purpose, cloudinary_public_id, secure_url, alt_text, display_order, status)
		 VALUES ($1, 'image', 'cover', $2, $3, $4, 0, 'active')
		 ON CONFLICT (cloudinary_public_id) DO UPDATE SET
		   secure_url = EXCLUDED.secure_url,
		   alt_text = EXCLUDED.alt_text,
		   status = 'active',
		   updated_at = CURRENT_TIMESTAMP`,
		businessID,
		"demo/"+slug+"/business-cover",
		imageURL,
		name+" cover image",
	); err != nil {
		return err
	}
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO venue_media (venue_id, media_type, purpose, cloudinary_public_id, secure_url, alt_text, display_order, status)
		 VALUES ($1, 'image', 'cover', $2, $3, $4, 0, 'active')
		 ON CONFLICT (cloudinary_public_id) DO UPDATE SET
		   secure_url = EXCLUDED.secure_url,
		   alt_text = EXCLUDED.alt_text,
		   status = 'active',
		   updated_at = CURRENT_TIMESTAMP`,
		venueID,
		"demo/"+slug+"/venue-cover",
		imageURL+"&venue=1",
		category.Name+" demo venue image",
	); err != nil {
		return err
	}
	var experienceID int64
	err := tx.QueryRowContext(
		ctx,
		`SELECT id FROM venue_experiences WHERE venue_id = $1 ORDER BY display_order, id LIMIT 1`,
		venueID,
	).Scan(&experienceID)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO experience_media (experience_id, media_type, purpose, cloudinary_public_id, secure_url, alt_text, display_order, status)
		 VALUES ($1, 'image', 'cover', $2, $3, $4, 0, 'active')
		 ON CONFLICT (cloudinary_public_id) DO UPDATE SET
		   secure_url = EXCLUDED.secure_url,
		   alt_text = EXCLUDED.alt_text,
		   status = 'active',
		   updated_at = CURRENT_TIMESTAMP`,
		experienceID,
		"demo/"+slug+"/experience-cover",
		"https://placehold.co/1200x800/111827/ffffff?text="+url.QueryEscape(subcategory.Name),
		subcategory.Name+" demo experience image",
	)
	return err
}

func seedDashboardAndActivity(ctx context.Context, tx *sql.Tx, businessID int64, venueID int64, category taxonomyCategory, subcategory taxonomySubcategory, itemIndex int) error {
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO business_dashboard_controls (
		   business_id, today_update, today_highlight, offer_title, offer_details,
		   offer_valid_until, offer_status, offer_clicks, profile_visits,
		   booking_clicks, direction_clicks, saves, updated_at
		 )
		 VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '21 days', 'active', $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
		 ON CONFLICT (business_id) DO UPDATE SET
		   today_update = EXCLUDED.today_update,
		   today_highlight = EXCLUDED.today_highlight,
		   offer_title = EXCLUDED.offer_title,
		   offer_details = EXCLUDED.offer_details,
		   offer_valid_until = EXCLUDED.offer_valid_until,
		   offer_status = EXCLUDED.offer_status,
		   offer_clicks = EXCLUDED.offer_clicks,
		   profile_visits = EXCLUDED.profile_visits,
		   booking_clicks = EXCLUDED.booking_clicks,
		   direction_clicks = EXCLUDED.direction_clicks,
		   saves = EXCLUDED.saves,
		   updated_at = CURRENT_TIMESTAMP`,
		businessID,
		"Demo live update: "+subcategory.Name+" is available today with fresh slots and walk-in support.",
		"Popular today: "+subcategory.Name,
		"Demo "+fmt.Sprint(10+itemIndex*5)+"% off "+subcategory.Name,
		"Use this active offer to test offer badges and discovery ranking.",
		40+itemIndex*13,
		120+itemIndex*30,
		18+itemIndex*4,
		22+itemIndex*5,
		35+itemIndex*6,
	); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM business_offers WHERE business_id = $1`, businessID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO business_offers (
		   business_id, venue_id, title, description, original_price, offer_price,
		   discount_percent, starts_on, ends_on, starts_at, ends_at, applicable_days,
		   terms, target_audience, status, click_count
		 )
		 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - INTERVAL '1 day',
		         CURRENT_DATE + INTERVAL '21 days', '10:00', '22:30', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
		         'Demo offer for testing only.', $8, 'active', $9)`,
		businessID,
		venueID,
		"Demo deal: "+subcategory.Name+" plan",
		"Active seed offer for discovery and business dashboard testing.",
		999+itemIndex*400,
		799+itemIndex*300,
		10+itemIndex*5,
		bestFor(category.Slug),
		40+itemIndex*13,
	); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM business_events WHERE business_id = $1`, businessID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO business_events (
		   business_id, venue_id, title, description, event_type, starts_at, ends_at,
		   price_min, price_max, booking_required, target_audience, terms, status
		 )
		 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + ($6::int || ' days')::interval,
		         CURRENT_TIMESTAMP + (($6::int + 1) || ' days')::interval,
		         $7, $8, true, $9, 'Demo event for testing only.', 'scheduled')`,
		businessID,
		venueID,
		"Demo event: "+subcategory.Name+" evening",
		"Scheduled event to test time-sensitive discovery cards.",
		category.Name,
		itemIndex+2,
		299+itemIndex*100,
		999+itemIndex*250,
		bestFor(category.Slug),
	); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM business_booking_requests WHERE business_id = $1`, businessID); err != nil {
		return err
	}
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO business_booking_requests (
		   business_id, requester_name, requester_contact, booking_note, booking_time, status
		 )
		 VALUES
		   ($1, 'Demo User', '+919900000001', 'Testing booking request from discovery.', CURRENT_TIMESTAMP + INTERVAL '2 days', 'pending'),
		   ($1, 'Demo Group', '+919900000002', 'Testing confirmed group booking.', CURRENT_TIMESTAMP + INTERVAL '5 days', 'confirmed')`,
		businessID,
	)
	return err
}

func businessName(category taxonomyCategory, index int, subcategory taxonomySubcategory) string {
	names := demoNames[category.Slug]
	if index < len(names) {
		return names[index]
	}
	return subcategory.Name + " Demo " + fmt.Sprint(index+1)
}

func existingDemoBusiness(ctx context.Context, db *sql.DB, email string) (bool, string, error) {
	var name string
	err := db.QueryRowContext(
		ctx,
		`SELECT business_name FROM business_accounts WHERE email = $1`,
		email,
	).Scan(&name)
	if err == nil {
		return true, name, nil
	}
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	return false, "", err
}

func printAudit(ctx context.Context, db *sql.DB) error {
	fmt.Println("Demo seed audit:")
	rows, err := db.QueryContext(
		ctx,
		`SELECT business_category, COUNT(*)
		 FROM business_accounts
		 WHERE email LIKE 'demo+%@zumers.test'
		 GROUP BY business_category
		 ORDER BY business_category`,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var category string
		var count int
		if err := rows.Scan(&category, &count); err != nil {
			return err
		}
		fmt.Printf("  %s: %d businesses\n", category, count)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	checks := []struct {
		Label string
		Query string
	}{
		{
			Label: "demo businesses",
			Query: `SELECT COUNT(*) FROM business_accounts WHERE email LIKE 'demo+%@zumers.test'`,
		},
		{
			Label: "approved profiles",
			Query: `SELECT COUNT(*) FROM business_accounts WHERE email LIKE 'demo+%@zumers.test' AND onboarding_status = 'approved'`,
		},
		{
			Label: "primary venues",
			Query: `SELECT COUNT(*) FROM business_venues v JOIN business_accounts b ON b.id = v.business_id WHERE b.email LIKE 'demo+%@zumers.test' AND v.is_primary = true AND v.status = 'active'`,
		},
		{
			Label: "businesses with 7 opening days",
			Query: `SELECT COUNT(*) FROM (
			          SELECT b.id
			          FROM business_accounts b
			          JOIN business_opening_hours h ON h.business_id = b.id
			          WHERE b.email LIKE 'demo+%@zumers.test'
			          GROUP BY b.id
			          HAVING COUNT(*) = 7
			        ) complete_hours`,
		},
		{
			Label: "businesses with 2+ experiences",
			Query: `SELECT COUNT(*) FROM (
			          SELECT b.id
			          FROM business_accounts b
			          JOIN business_venues v ON v.business_id = b.id AND v.is_primary = true
			          JOIN venue_experiences e ON e.venue_id = v.id AND e.status = 'active'
			          WHERE b.email LIKE 'demo+%@zumers.test'
			          GROUP BY b.id
			          HAVING COUNT(*) >= 2
			        ) complete_experiences`,
		},
		{
			Label: "active offers",
			Query: `SELECT COUNT(*) FROM business_offers o JOIN business_accounts b ON b.id = o.business_id WHERE b.email LIKE 'demo+%@zumers.test' AND o.status = 'active'`,
		},
		{
			Label: "scheduled events",
			Query: `SELECT COUNT(*) FROM business_events e JOIN business_accounts b ON b.id = e.business_id WHERE b.email LIKE 'demo+%@zumers.test' AND e.status = 'scheduled'`,
		},
		{
			Label: "business cover media",
			Query: `SELECT COUNT(*) FROM business_media m JOIN business_accounts b ON b.id = m.business_id WHERE b.email LIKE 'demo+%@zumers.test' AND m.status = 'active'`,
		},
		{
			Label: "venue cover media",
			Query: `SELECT COUNT(*) FROM venue_media m JOIN business_venues v ON v.id = m.venue_id JOIN business_accounts b ON b.id = v.business_id WHERE b.email LIKE 'demo+%@zumers.test' AND m.status = 'active'`,
		},
		{
			Label: "experience cover media",
			Query: `SELECT COUNT(*) FROM experience_media m JOIN venue_experiences e ON e.id = m.experience_id JOIN business_venues v ON v.id = e.venue_id JOIN business_accounts b ON b.id = v.business_id WHERE b.email LIKE 'demo+%@zumers.test' AND m.status = 'active'`,
		},
		{
			Label: "booking requests",
			Query: `SELECT COUNT(*) FROM business_booking_requests r JOIN business_accounts b ON b.id = r.business_id WHERE b.email LIKE 'demo+%@zumers.test'`,
		},
	}

	for _, check := range checks {
		var count int
		if err := db.QueryRowContext(ctx, check.Query).Scan(&count); err != nil {
			return err
		}
		fmt.Printf("  %s: %d\n", check.Label, count)
	}
	return nil
}

func demoEmail(category taxonomyCategory, index int) string {
	return fmt.Sprintf("demo+%s@zumers.test", demoSlug(category, index))
}

func demoSlug(category taxonomyCategory, index int) string {
	return slugify(category.Slug + "-" + fmt.Sprint(index+1))
}

func moodTags(categorySlug string) string {
	switch categorySlug {
	case "street-food", "restaurant-or-cafe":
		return "foodie, casual, chill, late-night"
	case "fun-and-entertainment":
		return "fun, casual, party"
	case "adventure":
		return "adventure, fun, premium"
	case "nightlife":
		return "party, late-night, premium"
	case "culture-and-events", "learning-and-hobbies":
		return "chill, fun, peaceful"
	case "relax-and-explore", "wellness-and-self-care":
		return "peaceful, chill, premium"
	default:
		return "fun, chill, casual"
	}
}

func serviceTags(categorySlug string) string {
	switch categorySlug {
	case "street-food", "restaurant-or-cafe":
		return "breakfast, lunch, dinner, quick-bite, walk-in"
	case "nightlife":
		return "live-music, dinner, booking"
	case "travel-or-transport":
		return "booking, walk-in"
	default:
		return "booking, walk-in, birthday-celebration"
	}
}

func bestFor(categorySlug string) string {
	switch categorySlug {
	case "nightlife":
		return "friends, couples, office-groups"
	case "wellness-and-self-care":
		return "solo, couples"
	case "learning-and-hobbies":
		return "solo, friends, college-students"
	case "relax-and-explore", "attractions-and-heritage":
		return "family, couples, friends"
	default:
		return "friends, family, couples"
	}
}

func facilityTags(categorySlug string) string {
	switch categorySlug {
	case "street-food":
		return "washroom, parking, outdoor-seating"
	case "adventure", "sports-and-fitness":
		return "parking, washroom, locker, kids-area"
	default:
		return "parking, washroom, wifi, air-conditioning"
	}
}

func indoorOutdoor(categorySlug string) string {
	switch categorySlug {
	case "street-food", "adventure", "relax-and-explore", "attractions-and-heritage", "shopping-and-markets":
		return "outdoor"
	case "sports-and-fitness":
		return "both"
	default:
		return "indoor"
	}
}

func slugify(value string) string {
	value = strings.ToLower(value)
	var builder strings.Builder
	lastDash := false
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteRune('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func returnFatal(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
