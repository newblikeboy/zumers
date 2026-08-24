# Database Plan

## Provider

Production PostgreSQL will be hosted on Aiven Cloud.

The application expects these backend environment variables:

```env
POSTGRES_URL=postgres://avnadmin:password@host:port/defaultdb?sslmode=require
```

`POSTGRES_URL` is the only required database setting. Use the PostgreSQL service URI from Aiven and keep `sslmode=require`.

For local development, place this value in `backend/.env`. The Go config loader reads that file automatically.

## Migration Tool

The backend uses Goose through `backend/cmd/migrate` with the `postgres` dialect.

Commands:

```bash
cd backend
go run ./cmd/migrate status
go run ./cmd/migrate up
go run ./cmd/migrate down
go run ./cmd/migrate version
go run ./cmd/migrate validate
```

## Tables

| Table | Purpose |
| --- | --- |
| `users` | Login identity, password hash, date of birth, account status |
| `profiles` | Public and private profile information |
| `friend_requests` | Pending and historical friend request records |
| `friendships` | Accepted friend relationships |
| `posts` | Text post records and feed visibility |
| `post_media` | Cloudinary image/video metadata for posts |
| `comments` | Post comments |
| `post_reactions` | Post reactions |
| `conversations` | One-to-one friend chat containers |
| `messages` | Chat message records |
| `notifications` | Friend, message, and post activity notifications |
| `business_dashboard_controls` | Business freshness message and dashboard metrics |
| `business_offers` | Normalized business discounts, deals, pricing windows, and offer status |
| `business_events` | Temporary business happenings such as live music, workshops, screenings, and festivals |
| `business_claim_requests` | Ownership claim requests for existing business records |

## Design Notes

- Friendships and conversations store user pairs in sorted order to prevent duplicate reverse rows.
- Media rows store Cloudinary public IDs so assets can be deleted or moderated later.
- Posts and messages use soft-delete columns to preserve audit/history behavior.
- Aiven PostgreSQL should use SSL with `sslmode=require`.
- Backend code must still enforce authorization. Database constraints are a second layer, not the only protection.
