# Zumers Key Product And Architecture Ideas

## North Star

Zumers is not a normal local business directory.

The core question is:

```text
What can we do nearby?
```

The user should be able to express intent, mood, time, budget, group size, or context, and Zumers should recommend useful nearby things to do.

Examples:

- We are hungry.
- We want street food.
- We have 3 hours.
- We are 5 friends.
- We have Rs 2,000 total.
- It is raining.
- It is Saturday night.
- We want something peaceful.
- We want something fun nearby.

The social features are important, but they are an engagement and planning layer. Feed, friends, groups, chat, voting, reactions, reels, and sharing should help users turn a discovery result into a real plan.

## Core Product Philosophy

Do not design Zumers as:

```text
User searches -> Find nearby businesses
```

Design it as:

```text
User intent -> Understand context -> Find things to do -> Recommend suitable places/experiences
```

The system should not only answer:

```text
Which businesses are nearby?
```

It should answer:

```text
What can we do nearby right now?
```

This difference should guide database design, APIs, onboarding, dashboard, search, ranking, and the future recommendation engine.

## Current Architecture Findings

The current codebase already has useful foundations:

- Separate user and business flows.
- User website target: `zumers.in`.
- Business website target: `business.zumers.in`.
- Business signup and login.
- Business dashboard.
- Business profile fields.
- Business category and subcategory.
- Mood tags, service tags, and best-for fields.
- Address, city, area, pincode, latitude, and longitude.
- Current-location flow using browser geolocation and Google Maps geocoder.
- Today update.
- Offer controls.
- Booking request table.
- Social layer with feed, posts, friends, chat, and groups.

The current business model is still mostly:

```text
Business account = Business profile = One location
```

This is acceptable for the current stage, but the long-term architecture should evolve into:

```text
Business user account
  -> Business / brand
  -> Venue / location / branch
  -> Experiences / activities
  -> Offers / events / media / availability
```

## Main Architecture Direction

Separate these concepts clearly:

```text
Account
Business / Brand
Venue / Location / Branch
Experience / Activity
Offer
Event
Media
Verification
Analytics
```

Users generally do not care about the legal business entity. They care about what they can do there.

Example:

```text
Business:
Timezone Entertainment

Venue:
Timezone Pacific Mall

Experiences:
- Bowling
- VR Gaming
- Arcade
- Bumper Cars
```

Another example:

```text
Business:
Sky Rooftop Cafe

Experiences:
- Rooftop dinner
- Coffee
- Live music
- Couple date
```

The recommendation engine needs to understand experiences, not only business descriptions.

## What We Can Reuse

The current implementation can be reused as the first version of the business profile and default venue.

Reusable fields:

- `business_name`
- `business_category`
- `business_subcategory`
- `location`
- `address`
- `city`
- `area`
- `postal_code`
- `latitude`
- `longitude`
- `service_radius_km`
- `price_range`
- `mood_tags`
- `service_tags`
- `best_for`
- `website_url`
- `whatsapp_number`
- `contact_phone`
- `description`
- `offerings`
- `opening_hours`
- `onboarding_status`
- dashboard today update
- dashboard offer controls
- booking request structure

Current location work should be kept:

```text
Use current location
  -> Browser geolocation
  -> Latitude / longitude
  -> Google Maps geocoder
  -> Address / city / area / pincode
  -> Editable preview
  -> Submit to backend
```

Latitude and longitude should remain hidden from business users and treated as backend discovery data.

## Missing Models And Tables

These should be added incrementally, not all at once.

### Business Accounts

Current `business_accounts` mixes login identity and public business profile.

Long-term, separate:

```text
business_users
businesses
business_user_memberships
```

This will support owners, admins, branch managers, marketing managers, and staff.

### Venues

Add a venue/location/branch model.

Suggested table:

```text
business_venues
```

Purpose:

- Store physical locations.
- Support multi-location businesses.
- Hold exact address and geospatial data.
- Act as the parent for experiences, events, offers, hours, and venue media.

Initial backward-compatible migration:

- Keep existing `business_accounts`.
- Create one default venue per existing business.
- Keep old fields until the new venue model is fully adopted.

### Experiences / Activities

Add:

```text
venue_experiences
```

Purpose:

- Store what people can do at a venue.
- Support recommendation logic.
- Support pricing, duration, audience, group size, mood, indoor/outdoor, and availability.

Example fields:

- name
- description
- category
- tags
- starting_price
- average_price_per_person
- typical_duration_minutes
- indoor_outdoor
- min_group_size
- ideal_group_size
- max_group_size
- booking_required
- walk_in_available
- status

### Events

Add:

```text
business_events
```

Events are temporary and should not be mixed with permanent venue data.

Examples:

- DJ night
- Stand-up comedy
- Workshop
- Food festival
- IPL screening
- Live music night

### Offers

Current dashboard supports one live offer. Long-term, offers should be separate rows.

Add:

```text
business_offers
```

Fields should support:

- title
- description
- original_price
- offer_price
- discount
- start date
- end date
- start time
- end time
- applicable days
- terms
- target audience
- status

### Media

Media should be classified.

Do not only store a gallery of URLs. Store media type/purpose.

Examples:

- logo
- cover
- exterior
- interior
- food
- activity
- menu
- atmosphere
- video
- reel

Separate:

```text
business_uploaded_media
customer_uploaded_media
```

### Opening Hours

Current opening hours are text. Recommendation logic needs structured day-wise hours.

Add:

```text
venue_opening_hours
venue_special_hours
```

Support:

- different timings per day
- multiple intervals
- 24 hours
- closed
- temporarily closed
- holiday hours
- special hours

This enables searches like:

- Open now
- Open tonight
- Open after 10 PM
- What can we do at 11 PM?

### Taxonomy

Avoid relying only on free-text fields where ranking depends on values.

Add controlled taxonomy tables:

```text
business_categories
business_subcategories
experience_tags
mood_tags
audience_tags
facility_tags
amenity_tags
```

These should power dropdowns, multi-selects, toggles, and category-specific onboarding.

## Business Signup Direction

Signup should be short.

Do not collect full business information during account creation.

Ideal signup captures:

- full name
- mobile number
- mobile OTP verification
- email
- password, if password auth is used
- accept terms
- accept privacy policy

Flow:

```text
Create account
  -> Verify mobile
  -> Create or claim business
  -> Business onboarding
```

Do not ask for GST, address, photos, amenities, opening hours, pricing, or experiences during first signup.

Current signup asks for business name, category, and location. This is acceptable for the current stage, but should be simplified later when account and business models are separated.

## Business Onboarding Direction

The business profile should become a multi-step wizard instead of one long form.

Suggested flow:

1. Business identity
2. Category
3. Location
4. Contact
5. Business hours
6. What can people do here?
7. Audience / group suitability
8. Pricing
9. Duration
10. Vibe / mood
11. Category-specific details
12. Facilities
13. Photos and videos
14. Verification
15. Preview
16. Publish

Support:

- Save and continue later
- Profile completeness score
- Optional fields
- Minimum publish requirements
- Category-specific sections

## Minimum Fields Before Publishing

Minimum required fields should be:

- business or venue name
- primary category
- exact location
- public contact
- opening hours
- at least one experience/activity
- approximate price or budget information
- at least one good photo

Other fields should improve completeness but not block early publication.

## Field Types

### Dropdowns

Use dropdowns for:

- primary category
- subcategory
- price range
- indoor/outdoor
- business type
- verification status
- offer status
- event status

### Multi-selects

Use multi-selects for:

- mood tags
- service tags
- audience tags
- facilities
- amenities
- best time to visit
- applicable days
- experience tags

### Toggles

Use toggles for:

- reservation available
- walk-in available
- booking required
- veg available
- non-veg available
- seating available
- takeaway available
- parking available
- pet friendly
- food available
- indoor/outdoor where binary
- location verified

### Numeric Fields

Use numeric fields for:

- starting price
- average spend per person
- average spend per couple
- entry fee
- activity fee
- package price
- minimum spend
- service radius
- typical duration
- min group size
- ideal group size
- max group size
- capacity
- location accuracy
- latitude
- longitude

Latitude and longitude should not be shown as normal business-facing fields.

### Automatically Derived Fields

Derive where possible:

- address from Google geocoder
- city
- area
- pincode
- state
- country
- latitude
- longitude
- distance from user
- open now
- profile completeness
- freshness score
- estimated total budget
- estimated duration

### Category-specific Fields

Restaurant / cafe:

- cuisine
- veg/non-veg
- breakfast/lunch/dinner
- outdoor seating
- live music
- average meal price
- table reservation
- takeaway

Street food:

- food type
- speciality
- popular items
- average spend per person
- starting price
- veg available
- non-veg available
- seating available
- standing/eating area
- takeaway
- operating time
- fixed location
- landmark
- payment methods
- food photos
- stall photos
- best for
- typical duration

Gaming zone:

- bowling
- arcade
- VR
- pool
- age limits
- per-game pricing
- hourly pricing
- party packages

Sports venue:

- sport types
- court/turf type
- slot duration
- hourly price
- equipment available
- changing room
- shower
- locker

Adventure venue:

- activity types
- minimum age
- maximum age
- height requirement
- safety gear
- instructor available
- duration
- per-person price
- group price

## Street Food Is First-class

Street food should not be hidden under restaurants.

It should be a major category because "street food chalte hain" is itself a plan.

Street food should support:

- single vendor
- street food destination
- food market
- food walk
- multiple vendors under one destination later

Discovery examples:

- Nearby street food
- Rs 500 me 4 friends kya kha sakte hain?
- Best momos nearby
- Street food market near me
- Late-night food nearby
- Aaj kuch spicy khane chalte hain
- Famous local street food

## Location Requirements

Location is core to Zumers.

Support:

```text
Search business location
Use current location
Drop pin on map
```

Current implemented support:

- Use current location
- Browser geolocation
- Google Maps geocoder
- Editable address preview
- Hidden latitude and longitude
- Pincode support

Still needed:

- Search business location with Google Places
- Drop pin on map
- Google Place ID
- state
- country
- district
- landmark
- building/shop
- street
- location accuracy meters
- location verified status
- manual map pin correction

## Contact And Booking

Public business contact should be separate from account-owner contact.

The owner's signup mobile number should not automatically become public.

Capture:

- public business phone
- WhatsApp number
- public business email
- website
- Instagram
- Facebook
- YouTube
- booking URL
- reservation available
- walk-in available

Preferred customer actions:

- call
- WhatsApp
- message on Zumers
- website
- book online

## Verification

Do not use only:

```text
verified = true / false
```

Use levels:

```text
unverified
phone_verified
location_verified
ownership_verified
zumers_verified
```

Possible verification methods:

- mobile OTP
- business phone OTP
- business email
- website/domain verification
- Google place matching
- GSTIN, optional
- Udyam, optional
- business document upload
- physical verification later

GST should not be mandatory for all businesses because many valid small vendors and street-food sellers may not have GST.

## Duplicate Prevention

Before creating a business or venue, search existing Zumers records.

Use Google Place ID where possible.

Example:

```text
The Terrace Cafe
Rajouri Garden
```

If a match exists, show:

```text
Is this your business?
[Claim Business]
```

instead of creating duplicates.

## Recommendation Engine Direction

The future recommendation engine should compare user context with place and experience data.

User context:

- current location
- who the user is with
- group size
- available time
- total budget
- per-person budget
- mood
- indoor/outdoor preference
- current time
- day
- weather
- interests
- previous behavior
- friends' activity
- group preferences

Place / experience data:

- location
- distance
- experiences
- activities
- price
- best audience
- group size
- typical duration
- vibe
- opening hours
- indoor/outdoor
- facilities
- offers
- events
- popularity
- ratings/reviews
- freshness
- user-generated content

Flow:

```text
User intent
  -> Context understanding
  -> Matching / ranking engine
  -> Best things to do now
```

## Future Plan / Itinerary Model

Eventually Zumers should not only recommend one business.

It should build a plan:

```text
Plan
  -> Stop 1
  -> Stop 2
  -> Stop 3
```

Example:

```text
Cafe
  -> Bowling
  -> Street food
  -> Dessert
```

A plan should consider:

- travel distance
- current time
- opening hours
- total budget
- activity duration
- group size
- user preferences

This future feature should influence database design now, especially around venues, experiences, duration, pricing, and location.

## Recommended Step-by-step Implementation Plan

### Phase 1: Stabilize Current Business Profile

- Keep current business dashboard working.
- Keep existing `business_accounts` fields.
- Finish location foundation.
- Add missing location fields: Google Place ID, state, country, landmark, accuracy, verified status.
- Keep latitude and longitude hidden from business users.
- Add profile completeness calculation.

### Phase 2: Controlled Taxonomy

- Status: Complete for the current single-business profile model. Initial `business_categories`, `business_subcategories`, and `business_discovery_tags` tables are added, with a public taxonomy API, Business UI category dropdowns, and taxonomy-backed multi-select controls for mood, service, audience/best-for, and facilities.
- Add category and tag taxonomy tables.
- Replace free-text category inputs with dropdowns.
- Replace free-text mood/service/best-for fields with multi-selects.
- Make Street Food first-class.
- Keep backward compatibility by mapping old free-text values where possible.

### Phase 3: Multi-step Onboarding

- Status: Complete for the current single-business profile model. The Business profile form is now split into wizard steps with profile completeness, section navigation, save draft, and submit onboarding actions.
- Convert the profile form into a wizard.
- Steps: identity, category, location, contact, hours, activities, audience, pricing, media, verification, preview.
- Support save and continue later.
- Keep draft/submitted/approved status.
- Add required-vs-optional logic.

### Phase 4: Structured Opening Hours

- Status: Complete for the current single-business profile model. Opening hours are now stored in `business_opening_hours` with weekday, interval order, closed/open state, and 24-hour open/close times. The Business onboarding wizard has a day-wise editor with up to two intervals per day while preserving the old readable `opening_hours` summary.
- Add day-wise opening hours tables.
- Support multiple intervals and closed days.
- Derive open-now status.
- Later use in discovery ranking.

### Phase 5: Venue Model

- Status: Complete for the current single-business profile model. Added `business_venues`, backfilled one primary venue per business, synchronized the primary venue from business profile updates, and exposed `primary_venue` in business responses. Full multi-branch management UI remains a later expansion.
- Add `business_venues`.
- Create one default venue for every existing business.
- Move location and venue-specific details into venues.
- Keep old fields until the frontend/API are migrated.

### Phase 6: Experiences / Activities

- Status: Complete for the current primary-venue model. Added `venue_experiences`, business profile save/load support, and a Business onboarding editor for concrete experiences such as Bowling, Rooftop Dinner, Momos, Live Music, or Go Karting. Experiences now carry price, duration, group-size, indoor/outdoor, booking, walk-in, and tag data.
- Add `venue_experiences`.
- Capture what people can do.
- Store numeric price and duration fields.
- Store audience, group size, mood, indoor/outdoor, booking, and walk-in fields.
- Make this the main future discovery dataset.

### Phase 7: Media

- Status: Complete for the current business onboarding model. Added `business_media`, `venue_media`, and `experience_media` tables, business-authenticated Cloudinary signing, business/venue/experience media response support, and an onboarding media step for cover, gallery, food/product, activity, menu/rate-card, and video uploads.
- Add business/venue/experience media tables.
- Classify media by purpose.
- Add upload UI for cover, gallery, food, activity, menu, and videos.

### Phase 8: Offers And Events

- Status: Complete for the current business dashboard model. Added `business_offers` and `business_events`, backfilled legacy dashboard offer fields into normalized offers, exposed `offers` and `events` in dashboard responses, and added dashboard controls for publishing a live offer and temporary event while keeping today's update as a lightweight freshness signal.
- Replace single dashboard offer fields with `business_offers`.
- Add `business_events`.
- Keep dashboard quick update as a lightweight freshness signal.

### Phase 9: Verification And Claiming

- Status: Complete for the current single-business account model. Added `verification_level` to businesses and venues, persisted `business_claim_requests`, added a public duplicate-check API using Google Place ID or name/location, added a business-authenticated claim request API, and added signup duplicate warnings before creating likely duplicate businesses.
- Add verification levels.
- Add claim-business flow.
- Add duplicate checks using name/location and Google Place ID.

### Phase 10: User-facing Discovery API

- Status: Complete for the first rule-based user discovery model. Added `/api/v1/discovery/search`, which parses natural-language intent and quick chips into category, mood, service, audience, budget, time, group-size, open-now, and location signals. The user app global search now opens a discovery overlay and returns ranked things-to-do cards from businesses, primary venues, venue experiences, active offers, and upcoming events.
- Add discovery search endpoint.
- Input should support location, mood, group size, budget, duration, time, and indoor/outdoor.
- Initial ranking can be rule-based.
- Later ranking can use engagement, saves, clicks, reviews, and social signals.

## Migration And Backward Compatibility Concerns

- Do not destructively remove existing `business_accounts` fields immediately.
- Add new tables beside the current model.
- Backfill one default venue per current business.
- Keep API response compatible while frontend migrates.
- Keep old free-text fields during taxonomy transition.
- Convert free-text tags to controlled tag IDs gradually.
- Use nullable fields for new optional data.
- Do not force every business to complete every field before publishing.
- Avoid category-specific columns on the main business table.
- Use separate category-attribute schemas for flexible future onboarding.

## Immediate Next Best Tasks

1. Add Google Place ID and location accuracy fields.
2. Add structured category taxonomy.
3. Convert business profile into a multi-step onboarding wizard.
4. Add profile completeness.
5. Add structured opening hours.
6. Add default venue model.
7. Add experiences/activities.

The most important next product move is to shift from:

```text
Business listing data
```

to:

```text
Structured things-to-do data
```

That is what will make the tagline real:

```text
Never wonder what to do today.
```
