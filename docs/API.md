# Backend API

Base path:

```text
/api/v1
```

## Authentication

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/signup` | No | Create an 18+ individual user account |
| POST | `/auth/login` | No | Log in |
| POST | `/auth/refresh` | No | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | Yes | Revoke a refresh token |
| GET | `/me` | Yes | Return current user and profile |

Signup body:

```json
{
  "email": "person@example.com",
  "password": "password123",
  "date_of_birth": "1998-04-15",
  "display_name": "Maya Rao",
  "username": "maya"
}
```

Login body:

```json
{
  "email": "person@example.com",
  "password": "password123"
}
```

Refresh/logout body:

```json
{
  "refresh_token": "opaque-refresh-token"
}
```

## Discovery

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/discovery/search` | Yes | Search structured business, venue, experience, offer, and event data as user-facing things to do |

Query parameters:

| Name | Purpose |
| --- | --- |
| `q` | Natural-language intent, for example `momos near me`, `fun tonight`, or `date cafe under 1000` |
| `chips` | Comma-separated quick filters such as `Open now,Friends,Under 1000` |
| `latitude` / `longitude` | Optional user location for distance scoring |
| `radius_km` | Optional nearby radius filter when latitude and longitude are present. Clamped from 1 to 50 km |
| `limit` | Result count, capped by the API |

The response includes interpreted categories, moods, services, audiences, budget, group size, duration, and ranked result cards.

## Business

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/business/signup` | No | Create a business account |
| POST | `/business/login` | No | Log in to a business account |
| GET | `/business/taxonomy` | No | Return controlled business categories, subcategories, and discovery tags |
| POST | `/business/duplicate-check` | No | Check existing businesses by Google Place ID or name/location before signup |
| POST | `/business/claims` | Business | Submit a claim request for an existing business |
| GET | `/business/me` | Business | Return current business profile |
| PATCH | `/business/me` | Business | Update business profile and onboarding data |
| POST | `/business/media/sign-upload` | Business | Create a Cloudinary signed upload payload for business onboarding media |
| GET | `/business/dashboard` | Business | Load business dashboard controls and booking requests |
| PATCH | `/business/dashboard` | Business | Update today update, normalized offers, and events |

Duplicate check body:

```json
{
  "business_name": "Johri Restaurant",
  "location": "Rajouri Garden, New Delhi",
  "google_place_id": "ChIJ..."
}
```

Create claim request body:

```json
{
  "existing_business_id": 42,
  "claimant_name": "Aman Johri",
  "claimant_phone": "+919999999999",
  "claimant_note": "I manage this location.",
  "evidence_url": "https://example.com/proof",
  "match_source": "name_location"
}
```

Dashboard responses include the legacy primary offer fields for compatibility plus normalized `offers` and `events` arrays.

Create or update the primary offer:

```json
{
  "offer_id": 12,
  "offer_title": "20% off lunch buffet",
  "offer_details": "Valid for dine-in groups before 4 PM.",
  "offer_valid_until": "2026-09-30",
  "offer_status": "active"
}
```

Create a temporary business event:

```json
{
  "event_title": "Live music night",
  "event_details": "Acoustic set with dinner service.",
  "event_type": "Live music",
  "event_starts_at": "2026-09-05T20:00",
  "event_ends_at": "2026-09-05T23:00",
  "event_status": "scheduled"
}
```

Business profile updates can include discovery fields used later by the user-facing search engine:

```json
{
  "business_name": "Johri Restaurant",
  "business_category": "Restaurant or cafe",
  "business_subcategory": "North Indian",
  "location": "Rajouri Garden, New Delhi",
  "address": "Full street address",
  "city": "New Delhi",
  "area": "Rajouri Garden",
  "postal_code": "110027",
  "google_place_id": "ChIJ...",
  "state": "Delhi",
  "country": "India",
  "district": "West Delhi",
  "landmark": "Near metro station",
  "latitude": 28.6467,
  "longitude": 77.1200,
  "location_accuracy_meters": 18.5,
  "service_radius_km": 5,
  "price_range": "moderate",
  "mood_tags": "hungry, friends hangout, family dinner",
  "service_tags": "north indian, buffet, live music",
  "best_for": "friends, family, office groups",
  "facility_tags": "parking, washroom, outdoor seating",
  "opening_hours_schedule": [
    {
      "weekday": 0,
      "interval_order": 1,
      "is_closed": false,
      "opens_at": "11:00",
      "closes_at": "23:00"
    },
    {
      "weekday": 1,
      "interval_order": 1,
      "is_closed": true
    }
  ],
  "venue_experiences": [
    {
      "experience_name": "Bowling",
      "description": "60-minute lane booking for friends and groups.",
      "category": "Gaming",
      "tags": "fun, friends hangout",
      "starting_price": 350,
      "average_price_per_person": 500,
      "typical_duration_minutes": 60,
      "min_group_size": 2,
      "ideal_group_size": 4,
      "max_group_size": 8,
      "indoor_outdoor": "indoor",
      "booking_required": true,
      "walk_in_available": true,
      "status": "active",
      "display_order": 1,
      "media": []
    }
  ],
  "business_media": [
    {
      "media_type": "image",
      "purpose": "cover",
      "cloudinary_public_id": "zumers/business-cover",
      "secure_url": "https://res.cloudinary.com/example/image/upload/...",
      "display_order": 0
    }
  ],
  "venue_media": [
    {
      "media_type": "video",
      "purpose": "video",
      "cloudinary_public_id": "zumers/venue-video",
      "secure_url": "https://res.cloudinary.com/example/video/upload/...",
      "thumbnail_url": "https://res.cloudinary.com/example/image/upload/...",
      "display_order": 0
    }
  ],
  "website_url": "https://example.com/menu",
  "whatsapp_number": "+919999999999"
}
```

Business responses also include `open_now`, derived from `opening_hours_schedule`.
Business responses also include `primary_venue`, a synchronized venue record created from the current single-location business profile.
`primary_venue.experiences` returns the structured activities users can do at that venue.
Business responses also include `media`, `primary_venue.media`, and `primary_venue.experiences[].media` arrays.

`price_range` must be one of `budget`, `moderate`, `premium`, or `luxury`. Tag fields are comma-separated and normalized by the API.
Business and venue media purposes can be `cover`, `gallery`, `food`, `activity`, `menu`, or `video`. Experience media purposes can be `cover`, `gallery`, `activity`, or `video`.

## Profiles

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/users/search?q=maya` | Yes | Search active users |
| GET | `/users/{id}` | Yes | View a profile |
| PATCH | `/me/profile` | Yes | Update own profile |

## Friends

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/friends/requests` | Yes | Send a friend request |
| GET | `/friends/requests` | Yes | List incoming friend requests |
| GET | `/friends/requests?direction=outgoing` | Yes | List outgoing friend requests |
| POST | `/friends/requests/{id}/accept` | Yes | Accept request |
| POST | `/friends/requests/{id}/reject` | Yes | Reject request |
| GET | `/friends` | Yes | List friends |
| GET | `/friends/suggestions` | Yes | Ranked friend suggestions |
| DELETE | `/friends/{id}` | Yes | Unfriend |

Friend suggestions rank active non-friends by mutual friends, same location, and recent account creation. Existing friends, self, and users with pending requests in either direction are excluded.

## Posts

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/posts` | Yes | Create text/media post |
| GET | `/feed` | Yes | View own, friend, and public posts |
| GET | `/users/{id}/posts` | Yes | View visible posts by one user |
| PATCH | `/posts/{id}` | Yes | Edit own post |
| DELETE | `/posts/{id}` | Yes | Soft-delete own post |
| POST | `/posts/{id}/reactions` | Yes | Like/react to a post |
| DELETE | `/posts/{id}/reactions` | Yes | Remove own reaction |
| GET | `/posts/{id}/comments` | Yes | List comments |
| POST | `/posts/{id}/comments` | Yes | Add comment |
| DELETE | `/comments/{id}` | Yes | Delete own comment |
| POST | `/posts/{id}/share` | Yes | Share/repost a visible post |

Reaction body:

```json
{
  "reaction_type": "like"
}
```

Comment body:

```json
{
  "content": "Nice post"
}
```

Share body:

```json
{
  "content": "Sharing this",
  "visibility": "friends"
}
```

## Media

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/media/sign-upload` | Yes | Create a Cloudinary signed upload payload |

Cloudinary signing requires these env vars:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=zumers-dev
CLOUDINARY_MAX_IMAGE_BYTES=10485760
CLOUDINARY_MAX_VIDEO_BYTES=209715200
CLOUDINARY_MAX_VIDEO_SECONDS=300
```

The signed upload response includes allowed MIME prefixes and max upload limits. The frontend validates images/videos before upload, shows progress, and only creates posts after Cloudinary returns successful metadata.

## Chat

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/conversations` | Yes | List conversations |
| POST | `/conversations` | Yes | Create or return a friend conversation, or create a group conversation |
| GET | `/conversations/{id}/messages` | Yes | List message history |
| POST | `/conversations/{id}/messages` | Yes | Send a message |
| POST | `/conversations/{id}/read` | Yes | Mark received messages as read |
| WS | `/ws/chat?access_token=...` | Access token query | Real-time chat events |

Create conversation body:

```json
{
  "friend_id": 2
}
```

Create group conversation body:

```json
{
  "title": "Weekend plans",
  "member_ids": [2, 3, 4]
}
```

Group creation requires at least two selected friends. The current user is added as the group owner automatically.
Conversation `members` include `role`, with `owner` representing the group admin.

Send message body:

```json
{
  "message_type": "text",
  "content": "Hello"
}
```

Message responses include receipt totals for direct and group chats:

```json
{
  "recipient_count": 3,
  "delivered_count": 3,
  "read_count": 2
}
```

Message responses also include per-recipient `receipts` with `user`, `delivered_at`, and `read_at` fields so the frontend can show message info for group chats. The frontend uses the totals and receipt rows for sent, delivered, and seen indicators.

WebSocket send event:

```json
{
  "type": "message.send",
  "conversation_id": 1,
  "message_type": "text",
  "content": "Hello"
}
```

WebSocket read event:

```json
{
  "type": "conversation.read",
  "conversation_id": 1
}
```

## Notifications

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | Yes | List notifications |
| POST | `/notifications/{id}/read` | Yes | Mark notification as read |
