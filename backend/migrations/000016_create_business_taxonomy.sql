-- +goose Up
CREATE TABLE business_categories (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE business_subcategories (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES business_categories(id) ON DELETE CASCADE,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_business_subcategories_category_slug UNIQUE (category_id, slug),
  CONSTRAINT uq_business_subcategories_category_name UNIQUE (category_id, name)
);

CREATE TABLE business_discovery_tags (
  id BIGSERIAL PRIMARY KEY,
  tag_type VARCHAR(40) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_business_discovery_tag_type CHECK (tag_type IN ('mood', 'service', 'audience', 'facility')),
  CONSTRAINT uq_business_discovery_tags_type_slug UNIQUE (tag_type, slug),
  CONSTRAINT uq_business_discovery_tags_type_name UNIQUE (tag_type, name)
);

CREATE INDEX idx_business_subcategories_category_order
  ON business_subcategories (category_id, display_order, name);
CREATE INDEX idx_business_discovery_tags_type_order
  ON business_discovery_tags (tag_type, display_order, name);

INSERT INTO business_categories (slug, name, description, display_order) VALUES
  ('street-food', 'Street food', 'Street food vendors, food markets, food walks, and local specialities.', 10),
  ('restaurant-or-cafe', 'Restaurant or cafe', 'Restaurants, cafes, rooftop cafes, fine dining, dhabas, bakeries, and dessert places.', 20),
  ('fun-and-entertainment', 'Fun and entertainment', 'Bowling, gaming zones, cinema, arcade, VR, karaoke, and other fun outings.', 30),
  ('adventure', 'Adventure', 'Go karting, trampoline parks, paintball, water parks, treks, and outdoor activities.', 40),
  ('nightlife', 'Nightlife', 'Clubs, pubs, lounges, live music, DJ venues, and late-night plans.', 50),
  ('culture-and-events', 'Culture and events', 'Theatre, museums, exhibitions, workshops, concerts, festivals, and special events.', 60),
  ('sports-and-fitness', 'Sports and fitness', 'Sports arenas, turfs, courts, swimming, skating, and active experiences.', 70),
  ('relax-and-explore', 'Relax and explore', 'Parks, gardens, lakes, resorts, scenic places, and peaceful outings.', 80),
  ('travel-or-transport', 'Travel or transport', 'Tours, weekend trips, transport providers, stays, and local ride operators.', 90),
  ('other-local-service', 'Other local service', 'Local experience or service that does not fit another category yet.', 100)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO business_subcategories (category_id, slug, name, display_order)
SELECT c.id, item.slug, item.name, item.display_order
FROM business_categories c
JOIN (
  VALUES
    ('street-food', 'chaat', 'Chaat', 10),
    ('street-food', 'momos', 'Momos', 20),
    ('street-food', 'rolls', 'Rolls', 30),
    ('street-food', 'golgappe', 'Golgappe', 40),
    ('street-food', 'chole-bhature', 'Chole Bhature', 50),
    ('street-food', 'south-indian', 'South Indian', 60),
    ('street-food', 'chinese', 'Chinese', 70),
    ('street-food', 'desserts', 'Ice Cream / Desserts', 80),
    ('street-food', 'tea-coffee', 'Tea / Coffee', 90),
    ('street-food', 'street-food-market', 'Street Food Market', 100),
    ('restaurant-or-cafe', 'restaurant', 'Restaurant', 10),
    ('restaurant-or-cafe', 'cafe', 'Cafe', 20),
    ('restaurant-or-cafe', 'rooftop-cafe', 'Rooftop Cafe', 30),
    ('restaurant-or-cafe', 'fine-dining', 'Fine Dining', 40),
    ('restaurant-or-cafe', 'dhaba', 'Dhaba', 50),
    ('restaurant-or-cafe', 'bakery', 'Bakery', 60),
    ('restaurant-or-cafe', 'dessert-place', 'Dessert Place', 70),
    ('fun-and-entertainment', 'cinema', 'Cinema', 10),
    ('fun-and-entertainment', 'bowling', 'Bowling', 20),
    ('fun-and-entertainment', 'gaming-zone', 'Gaming Zone', 30),
    ('fun-and-entertainment', 'arcade', 'Arcade', 40),
    ('fun-and-entertainment', 'vr-gaming', 'VR Gaming', 50),
    ('fun-and-entertainment', 'escape-room', 'Escape Room', 60),
    ('fun-and-entertainment', 'karaoke', 'Karaoke', 70),
    ('adventure', 'go-karting', 'Go Karting', 10),
    ('adventure', 'trampoline-park', 'Trampoline Park', 20),
    ('adventure', 'rock-climbing', 'Rock Climbing', 30),
    ('adventure', 'paintball', 'Paintball', 40),
    ('adventure', 'water-park', 'Water Park', 50),
    ('nightlife', 'club', 'Club', 10),
    ('nightlife', 'pub', 'Pub', 20),
    ('nightlife', 'lounge', 'Lounge', 30),
    ('nightlife', 'live-music', 'Live Music', 40),
    ('culture-and-events', 'theatre', 'Theatre', 10),
    ('culture-and-events', 'museum', 'Museum', 20),
    ('culture-and-events', 'workshop', 'Workshop', 30),
    ('culture-and-events', 'concert', 'Concert', 40),
    ('culture-and-events', 'festival', 'Festival', 50),
    ('sports-and-fitness', 'badminton', 'Badminton', 10),
    ('sports-and-fitness', 'cricket-turf', 'Cricket Turf', 20),
    ('sports-and-fitness', 'football-turf', 'Football Turf', 30),
    ('sports-and-fitness', 'swimming', 'Swimming', 40),
    ('relax-and-explore', 'park', 'Park', 10),
    ('relax-and-explore', 'garden', 'Garden', 20),
    ('relax-and-explore', 'lake', 'Lake', 30),
    ('relax-and-explore', 'resort', 'Resort', 40),
    ('travel-or-transport', 'weekend-trip', 'Weekend Trip', 10),
    ('travel-or-transport', 'tour-operator', 'Tour Operator', 20),
    ('travel-or-transport', 'local-ride', 'Local Ride', 30)
) AS item(category_slug, slug, name, display_order) ON item.category_slug = c.slug
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO business_discovery_tags (tag_type, slug, name, display_order) VALUES
  ('mood', 'chill', 'Chill', 10),
  ('mood', 'fun', 'Fun', 20),
  ('mood', 'adventure', 'Adventure', 30),
  ('mood', 'romantic', 'Romantic', 40),
  ('mood', 'party', 'Party', 50),
  ('mood', 'peaceful', 'Peaceful', 60),
  ('mood', 'premium', 'Premium', 70),
  ('mood', 'casual', 'Casual', 80),
  ('mood', 'foodie', 'Foodie', 90),
  ('mood', 'late-night', 'Late Night', 100),
  ('audience', 'friends', 'Friends', 10),
  ('audience', 'couples', 'Couples', 20),
  ('audience', 'family', 'Family', 30),
  ('audience', 'kids', 'Kids', 40),
  ('audience', 'solo', 'Solo', 50),
  ('audience', 'large-groups', 'Large Groups', 60),
  ('audience', 'college-students', 'College Students', 70),
  ('audience', 'office-groups', 'Office Groups', 80),
  ('facility', 'parking', 'Parking', 10),
  ('facility', 'washroom', 'Washroom', 20),
  ('facility', 'wheelchair-access', 'Wheelchair Access', 30),
  ('facility', 'air-conditioning', 'Air Conditioning', 40),
  ('facility', 'wifi', 'Wi-Fi', 50),
  ('facility', 'outdoor-seating', 'Outdoor Seating', 60),
  ('facility', 'kids-area', 'Kids Area', 70),
  ('facility', 'pet-friendly', 'Pet Friendly', 80),
  ('service', 'breakfast', 'Breakfast', 10),
  ('service', 'lunch', 'Lunch', 20),
  ('service', 'dinner', 'Dinner', 30),
  ('service', 'coffee', 'Coffee', 40),
  ('service', 'live-music', 'Live Music', 50),
  ('service', 'birthday-celebration', 'Birthday Celebration', 60),
  ('service', 'quick-bite', 'Quick Bite', 70),
  ('service', 'food-walk', 'Food Walk', 80),
  ('service', 'booking', 'Booking', 90),
  ('service', 'walk-in', 'Walk-in', 100)
ON CONFLICT (tag_type, slug) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  active = true,
  updated_at = CURRENT_TIMESTAMP;

-- +goose Down
DROP TABLE IF EXISTS business_discovery_tags;
DROP TABLE IF EXISTS business_subcategories;
DROP TABLE IF EXISTS business_categories;
