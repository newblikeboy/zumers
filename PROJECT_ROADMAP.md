# Zumers Project Roadmap

## Project Goal

Build a social networking web application similar to Facebook, but only for individual users aged 18 or older.

The application will support:

- Self profile creation
- Friend requests and friend management
- Sharing thoughts, photos, and videos
- Chatting with friends
- Cloudinary-based photo and video storage/streaming
- React frontend
- Go backend
- PostgreSQL database hosted on Aiven Cloud

## Completion Status Legend

Use these statuses for every task:

- `Not Started`
- `In Progress`
- `Done`
- `Blocked`
- `Skipped`

Every completed task should include:

- Status changed to `Done`
- Completion date
- Notes if any behavior, scope, or technical decision changed

Example:

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| EX-001 | Example task | Done | Backend | 2026-08-07 | Completed successfully |

## Product Rules

| ID | Rule | Status | Notes |
| --- | --- | --- | --- |
| PR-001 | Only individual user accounts are allowed | Not Started | No pages, no business profiles |
| PR-002 | User must be 18 years or older | Not Started | Validate during signup using date of birth |
| PR-003 | Users can create and edit their own profile | Not Started | Name, avatar, cover photo, bio, location, DOB privacy |
| PR-004 | Users can make friends only with individual users | Not Started | Friend request workflow required |
| PR-005 | Users can share text thoughts | Not Started | Feed post support |
| PR-006 | Users can share photos | Not Started | Upload and delivery through Cloudinary |
| PR-007 | Users can share videos | Not Started | Upload and streaming through Cloudinary |
| PR-008 | Users can chat only with friends | Not Started | Prevent messaging non-friends |

## High-Level Architecture

```text
React Frontend
  |
  | HTTPS REST API / WebSocket
  v
Go Backend API
  |
  | SQL
  v
Aiven PostgreSQL

Go Backend API
  |
  | Signed upload / media metadata
  v
Cloudinary
```

## Main Modules

| ID | Module | Description | Status |
| --- | --- | --- | --- |
| MOD-001 | Authentication | Signup, login, logout, JWT/session handling | Not Started |
| MOD-002 | User Profile | Profile creation, update, avatar, cover photo | Not Started |
| MOD-003 | Friends | Send, accept, reject, cancel, unfriend | Not Started |
| MOD-004 | Feed Posts | Text, photo, video posts | Not Started |
| MOD-005 | Media | Cloudinary upload, storage, streaming URLs | Not Started |
| MOD-006 | Chat | Friend-to-friend real-time messaging | Not Started |
| MOD-007 | Notifications | Friend request and chat notifications | Not Started |
| MOD-008 | Admin/Moderation Internal Tools | Basic user/post moderation hooks | Not Started |

## Phase 1: Project Foundation

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| FND-001 | Create project repository structure | Done | Full Stack | 2026-08-07 | Created `frontend`, `backend`, and `docs` |
| FND-002 | Initialize React frontend | Done | Frontend | 2026-08-07 | Created React + TypeScript + Vite app |
| FND-003 | Initialize Go backend | Done | Backend | 2026-08-07 | Go source skeleton created and verified with `go test ./...` |
| FND-004 | Create `.env.example` files | Done | Full Stack | 2026-08-07 | Added frontend and backend env examples |
| FND-005 | Configure Git ignore rules | Done | Full Stack | 2026-08-07 | Added root `.gitignore` for env files, dependencies, builds, and logs |
| FND-006 | Add local development README | Done | Full Stack | 2026-08-07 | Added root and backend README files |
| FND-007 | Decide API style | Done | Backend | 2026-08-07 | REST for core APIs, WebSocket for chat |
| FND-008 | Decide auth method | Done | Backend | 2026-08-07 | JWT access tokens plus refresh tokens |

## Phase 2: Database Design

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| DB-001 | Create Aiven PostgreSQL database | Done | Backend | 2026-08-08 | Aiven PostgreSQL URI configured in local `.env`; migration connection verified |
| DB-002 | Create migration system | Done | Backend | 2026-08-08 | Added Goose PostgreSQL migration command at `backend/cmd/migrate` |
| DB-003 | Create `users` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-004 | Create `profiles` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-005 | Create `friend_requests` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-006 | Create `friendships` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-007 | Create `posts` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-008 | Create `post_media` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-009 | Create `comments` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-010 | Create `post_reactions` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-011 | Create `conversations` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-012 | Create `messages` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-013 | Create `notifications` table | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-014 | Add database indexes | Done | Backend | 2026-08-08 | Applied in migration version 1 |
| DB-015 | Add seed data for local testing | Done | Backend | 2026-08-08 | Added PostgreSQL seed file at `backend/seeds/local_seed.sql` |

## Suggested Database Tables

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK | Auto increment |
| email | VARCHAR(255) UNIQUE | Login identity |
| password_hash | VARCHAR(255) | Never store plain password |
| date_of_birth | DATE | Required for 18+ validation |
| account_status | VARCHAR(30) | active, suspended, deleted |
| created_at | DATETIME |  |
| updated_at | DATETIME |  |

### `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| user_id | BIGINT FK | One profile per user |
| display_name | VARCHAR(120) | Required |
| username | VARCHAR(80) UNIQUE | Public profile handle |
| bio | TEXT | Optional |
| location | VARCHAR(120) | Optional |
| avatar_url | TEXT | Cloudinary image URL |
| cover_url | TEXT | Cloudinary image URL |
| created_at | DATETIME |  |
| updated_at | DATETIME |  |

### `friend_requests`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| sender_id | BIGINT FK | Request sender |
| receiver_id | BIGINT FK | Request receiver |
| status | VARCHAR(30) | pending, accepted, rejected, cancelled |
| created_at | DATETIME |  |
| updated_at | DATETIME |  |

### `friendships`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| user_id | BIGINT FK | Lower user ID can be stored here for uniqueness |
| friend_id | BIGINT FK | Higher user ID can be stored here for uniqueness |
| created_at | DATETIME |  |

### `posts`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| author_id | BIGINT FK | User who created the post |
| content | TEXT | Text thought |
| visibility | VARCHAR(30) | friends, public, private |
| created_at | DATETIME |  |
| updated_at | DATETIME |  |
| deleted_at | DATETIME NULL | Soft delete |

### `post_media`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| post_id | BIGINT FK | Related post |
| media_type | VARCHAR(20) | image or video |
| cloudinary_public_id | VARCHAR(255) | Required for management/deletion |
| secure_url | TEXT | Cloudinary delivery URL |
| thumbnail_url | TEXT | Useful for videos |
| width | INT | Optional |
| height | INT | Optional |
| duration_seconds | INT | Video only |
| created_at | DATETIME |  |

### `conversations`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| user_one_id | BIGINT FK | Participant |
| user_two_id | BIGINT FK | Participant |
| created_at | DATETIME |  |
| updated_at | DATETIME | Last message time |

### `messages`

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT PK |  |
| conversation_id | BIGINT FK |  |
| sender_id | BIGINT FK |  |
| message_type | VARCHAR(20) | text, image, video |
| content | TEXT | Text or media caption |
| media_url | TEXT | Optional Cloudinary URL |
| read_at | DATETIME NULL |  |
| created_at | DATETIME |  |
| deleted_at | DATETIME NULL | Soft delete |

## Phase 3: Backend API

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| API-001 | Create backend folder structure | Done | Backend | 2026-08-08 | Added `cmd/api`, `cmd/migrate`, `internal`, `migrations`, and domain handler files |
| API-002 | Add config loader | Done | Backend | 2026-08-08 | Reads OS env plus local `.env` |
| API-003 | Connect to Aiven PostgreSQL | Done | Backend | 2026-08-08 | API and migration command use `POSTGRES_URL` |
| API-004 | Add database migration command | Done | Backend | 2026-08-08 | Goose up/down/status/version/validate commands available |
| API-005 | Add password hashing | Done | Backend | 2026-08-08 | Added bcrypt hashing and verification |
| API-006 | Add JWT/session middleware | Done | Backend | 2026-08-08 | Added JWT access token middleware and hashed refresh-token storage |
| API-007 | Implement signup API | Done | Backend | 2026-08-08 | Includes backend 18+ validation |
| API-008 | Implement login API | Done | Backend | 2026-08-08 | Returns access and refresh tokens |
| API-009 | Implement logout/refresh API | Done | Backend | 2026-08-08 | Refresh tokens are rotated and revoked |
| API-010 | Implement current user API | Done | Backend | 2026-08-08 | Added authenticated `GET /api/v1/me` |
| API-011 | Implement profile create/update APIs | Done | Backend | 2026-08-08 | Profile created during signup; own profile update added |
| API-012 | Implement profile view API | Done | Backend | 2026-08-08 | Enforces `public`, `friends`, and `private` profile visibility |
| API-013 | Implement user search API | Done | Backend | 2026-08-08 | Added authenticated user search |
| API-014 | Implement friend request send API | Done | Backend | 2026-08-08 | Prevents self requests and existing friendships |
| API-015 | Implement accept/reject request APIs | Done | Backend | 2026-08-08 | Accept creates sorted friendship pair |
| API-016 | Implement friend list API | Done | Backend | 2026-08-08 | Added limited/paginated friend list |
| API-017 | Implement unfriend API | Done | Backend | 2026-08-08 | Removes sorted friendship pair |
| API-018 | Implement Cloudinary signed upload API | Done | Backend | 2026-08-08 | Endpoint added and Cloudinary credential ping verified |
| API-019 | Implement create post API | Done | Backend | 2026-08-08 | Supports text, Cloudinary media metadata, reactions, comments, and shares |
| API-020 | Implement feed API | Done | Backend | 2026-08-08 | Returns own, friend, and public posts |
| API-021 | Implement edit/delete post APIs | Done | Backend | 2026-08-08 | Author-only edit and soft delete added |
| API-022 | Implement WebSocket chat connection | Done | Backend | 2026-08-08 | Added authenticated `/ws/chat` endpoint |
| API-023 | Implement message send API/WebSocket event | Done | Backend | 2026-08-08 | REST and WebSocket message send enforce friend-only conversations |
| API-024 | Implement conversation list API | Done | Backend | 2026-08-08 | Added latest-message conversation list |
| API-025 | Implement message history API | Done | Backend | 2026-08-08 | Added paginated message history |
| API-026 | Implement read receipts | Done | Backend | 2026-08-08 | Added REST and WebSocket conversation read events |
| API-027 | Implement notification APIs | Done | Backend | 2026-08-08 | Added notification list/read APIs plus friend/message notifications |
| API-028 | Add request validation | Done | Backend | 2026-08-08 | Added strict JSON decoding and endpoint-level validation |
| API-029 | Add rate limiting | Done | Backend | 2026-08-08 | Added IP-based limits for auth, uploads, posts, messages, and WebSocket handshakes |
| API-030 | Add backend logging | Done | Backend | 2026-08-08 | Added structured request logging |
| API-031 | Implement realtime chat sent/delivered/read receipts | Done | Full Stack | 2026-08-08 | Added `delivered_at`, `message.delivered`, enriched `conversation.read`, and frontend message status labels |

## Suggested API Endpoints

### Authentication

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account, validate 18+ |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/me` | Current user |

### Profiles

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/users/:id` | View user profile |
| PATCH | `/api/me/profile` | Update own profile |
| GET | `/api/users/search?q=` | Search users |

### Friends

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/friends/requests` | Send friend request |
| GET | `/api/friends/requests` | List incoming/outgoing requests |
| POST | `/api/friends/requests/:id/accept` | Accept request |
| POST | `/api/friends/requests/:id/reject` | Reject request |
| DELETE | `/api/friends/:id` | Unfriend |
| GET | `/api/friends` | List friends |

### Posts and Feed

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/posts` | Create text/photo/video post |
| GET | `/api/feed` | Get feed |
| GET | `/api/users/:id/posts` | Get user's posts |
| PATCH | `/api/posts/:id` | Edit post |
| DELETE | `/api/posts/:id` | Delete post |

### Media

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/media/sign-upload` | Get Cloudinary upload signature |
| POST | `/api/media/complete` | Save uploaded media metadata |
| DELETE | `/api/media/:id` | Delete media reference and Cloudinary asset |

### Chat

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/:id/messages` | Message history |
| POST | `/api/conversations` | Create/get friend conversation |
| WS | `/ws/chat` | Real-time chat |

## Phase 4: Cloudinary Integration

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| CLD-001 | Create Cloudinary account/project | Done | Full Stack | 2026-08-08 | Cloudinary credentials are configured and credential ping passed |
| CLD-002 | Add Cloudinary env variables | Done | Backend | 2026-08-08 | Added Cloudinary credentials and upload limit env vars |
| CLD-003 | Create signed upload endpoint | Done | Backend | 2026-08-08 | `/api/v1/media/sign-upload` signs uploads without exposing API secret |
| CLD-004 | Configure allowed media types | Done | Backend | 2026-08-08 | Frontend/backend upload contract allows images and videos only |
| CLD-005 | Configure size/duration limits | Done | Backend | 2026-08-08 | Added image size, video size, and video duration limits |
| CLD-006 | Store Cloudinary public IDs | Done | Backend | 2026-08-08 | Stores public IDs for post media and profile avatar/cover uploads |
| CLD-007 | Use optimized image transformations | Done | Frontend | 2026-08-08 | Image upload URLs use `f_auto,q_auto,c_limit,w_1600` |
| CLD-008 | Use Cloudinary video streaming URLs | Done | Frontend | 2026-08-08 | Video posts use Cloudinary `q_auto/f_auto` progressive delivery with metadata preload and poster thumbnails; `sp_auto` adaptive streaming is documented as the next player upgrade |
| CLD-009 | Add upload progress UI | Done | Frontend | 2026-08-08 | Added progress bars for post media and avatar uploads |
| CLD-010 | Handle failed uploads safely | Done | Full Stack | 2026-08-08 | Frontend validates before upload and creates posts only after Cloudinary success |

## Phase 5: Frontend Application

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| FE-001 | Create React app structure | Done | Frontend | 2026-08-08 | Added `pages`, `components`, `lib`, and `auth` structure |
| FE-002 | Add routing | Done | Frontend | 2026-08-08 | Added React Router routes |
| FE-003 | Add API client | Done | Frontend | 2026-08-08 | Centralized API client with token refresh retry |
| FE-004 | Add auth state management | Done | Frontend | 2026-08-08 | Added auth provider and local token persistence |
| FE-005 | Build signup page | Done | Frontend | 2026-08-08 | Includes DOB field and backend 18+ validation response handling |
| FE-006 | Build login page | Done | Frontend | 2026-08-08 | Includes error states |
| FE-007 | Build protected route layout | Done | Frontend | 2026-08-08 | Added sidebar/topbar protected app shell |
| FE-008 | Build profile page | Done | Frontend | 2026-08-08 | Shows avatar, profile fields, and posts |
| FE-009 | Build edit profile UI | Done | Frontend | 2026-08-08 | Supports profile edits and avatar upload through Cloudinary |
| FE-010 | Build user search UI | Done | Frontend | 2026-08-08 | Includes add friend action |
| FE-011 | Build friend requests UI | Done | Frontend | 2026-08-08 | Supports accept/reject |
| FE-012 | Build friends list UI | Done | Frontend | 2026-08-08 | Includes chat and unfriend actions |
| FE-013 | Build post composer | Done | Frontend | 2026-08-08 | Supports text, image, and video metadata |
| FE-014 | Build Cloudinary upload flow | Done | Frontend | 2026-08-08 | Uses signed upload endpoint |
| FE-015 | Build feed page | Done | Frontend | 2026-08-08 | Loads backend feed |
| FE-016 | Build post card component | Done | Frontend | 2026-08-08 | Supports text, photos, videos, and owner delete |
| FE-017 | Build video player handling | Done | Frontend | 2026-08-08 | Renders uploaded video URLs in native player |
| FE-018 | Build chat layout | Done | Frontend | 2026-08-08 | Conversation list plus message panel |
| FE-019 | Add WebSocket chat client | Done | Frontend | 2026-08-08 | Connects to `/ws/chat` with access token |
| FE-020 | Build message composer | Done | Frontend | 2026-08-08 | Text message composer added |
| FE-021 | Add notifications UI | Done | Frontend | 2026-08-08 | Notification list and mark-read action added |
| FE-022 | Add loading, empty, and error states | Done | Frontend | 2026-08-08 | Added shared states across major screens |
| FE-023 | Add responsive design | Done | Frontend | 2026-08-08 | Mobile and desktop layouts added |
| FE-024 | Build Reels-style video experience | Done | Frontend | 2026-08-08 | Added `/reels` route with vertical video feed, autoplay/pause, mute, like, comment, and share actions |

## Phase 6: Security and Privacy

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Enforce 18+ signup on backend | Not Started | Backend |  | Frontend validation is not enough |
| SEC-002 | Hash passwords securely | Not Started | Backend |  | bcrypt or Argon2 |
| SEC-003 | Validate all request payloads | Not Started | Backend |  | Reject invalid input |
| SEC-004 | Add authorization checks | Not Started | Backend |  | Owner/friend access rules |
| SEC-005 | Prevent friend request abuse | Not Started | Backend |  | Rate limits and duplicate checks |
| SEC-006 | Prevent chat with non-friends | Not Started | Backend |  | Enforce on server |
| SEC-007 | Restrict upload file types | Not Started | Backend |  | Images/videos only |
| SEC-008 | Add upload size limits | Not Started | Backend |  | Avoid cost/security issues |
| SEC-009 | Add CORS configuration | Not Started | Backend |  | Allow frontend origins only |
| SEC-010 | Protect secrets | Not Started | Full Stack |  | No secrets in Git |
| SEC-011 | Add account deletion or deactivation path | Not Started | Backend |  | Important for privacy |
| SEC-012 | Add report/block foundation | Not Started | Full Stack |  | Recommended before public launch |

## Phase 7: Testing

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| TST-001 | Add backend unit tests | Not Started | Backend |  | Auth, age validation, friendship rules |
| TST-002 | Add backend integration tests | Not Started | Backend |  | PostgreSQL test database |
| TST-003 | Add frontend component tests | Not Started | Frontend |  | Main forms and feed components |
| TST-004 | Add frontend integration tests | Not Started | Frontend |  | Signup, login, posting, chat |
| TST-005 | Test Cloudinary image upload | Not Started | Full Stack |  | Dev account/folder |
| TST-006 | Test Cloudinary video upload and playback | Not Started | Full Stack |  | Streaming behavior |
| TST-007 | Test WebSocket reconnect behavior | Not Started | Full Stack |  | Network drop scenarios |
| TST-008 | Test authorization rules | Not Started | Backend |  | Profile, posts, friends, chat |
| TST-009 | Test mobile responsive layout | Not Started | Frontend |  | Feed, profile, chat |
| TST-010 | Add manual QA checklist | Not Started | QA |  | Before deployment |

## Phase 8: Deployment

| ID | Task | Status | Owner | Completed Date | Notes |
| --- | --- | --- | --- | --- | --- |
| DEP-001 | Choose frontend hosting | Not Started | Full Stack |  | Vercel, Netlify, or similar |
| DEP-002 | Choose backend hosting | Not Started | Full Stack |  | Render, Fly.io, Railway, VPS, etc. |
| DEP-003 | Configure production Aiven PostgreSQL | Not Started | Backend |  | Separate from dev database |
| DEP-004 | Configure production Cloudinary | Not Started | Full Stack |  | Separate folders or account |
| DEP-005 | Configure production env variables | Not Started | Full Stack |  | No secrets in repo |
| DEP-006 | Run database migrations in production | Not Started | Backend |  | Backup first |
| DEP-007 | Deploy backend API | Not Started | Backend |  | Confirm health endpoint |
| DEP-008 | Deploy frontend app | Not Started | Frontend |  | Point to production API |
| DEP-009 | Configure CORS for production domains | Not Started | Backend |  | Required after deployment |
| DEP-010 | Configure HTTPS | Not Started | Full Stack |  | Required for auth and WebSocket |
| DEP-011 | Configure logging/monitoring | Not Started | Full Stack |  | API errors and uptime |
| DEP-012 | Run production smoke test | Not Started | QA |  | Signup, login, post, upload, chat |

## Phase 9: MVP Acceptance Checklist

The project MVP is complete only when all required items below are `Done`.

| ID | Acceptance Item | Status | Notes |
| --- | --- | --- | --- |
| ACC-001 | A user aged 18+ can create an account | Not Started |  |
| ACC-002 | A user under 18 cannot create an account | Not Started |  |
| ACC-003 | A user can log in and log out | Not Started |  |
| ACC-004 | A user can create and update a self profile | Not Started |  |
| ACC-005 | A user can search for other users | Not Started |  |
| ACC-006 | A user can send a friend request | Not Started |  |
| ACC-007 | A user can accept or reject a friend request | Not Started |  |
| ACC-008 | A user can view their friend list | Not Started |  |
| ACC-009 | A user can create a text post | Not Started |  |
| ACC-010 | A user can create a photo post through Cloudinary | Not Started |  |
| ACC-011 | A user can create a video post through Cloudinary | Not Started |  |
| ACC-012 | A user can view a feed of their own and friends' posts | Not Started |  |
| ACC-013 | A user can chat with a friend in real time | Not Started |  |
| ACC-014 | A user cannot chat with a non-friend | Not Started |  |
| ACC-015 | The app works on mobile and desktop | Not Started |  |
| ACC-016 | Production deployment is live with HTTPS | Not Started |  |

## Recommended Build Order

1. Create project structure.
2. Build database migrations.
3. Build backend authentication with 18+ validation.
4. Build frontend signup/login.
5. Build profile APIs and profile UI.
6. Build friend request system.
7. Build basic text posts and feed.
8. Add Cloudinary photo upload.
9. Add Cloudinary video upload and streaming.
10. Build real-time chat.
11. Add notifications.
12. Add security hardening.
13. Add tests.
14. Deploy backend, frontend, database, and media configuration.
15. Run final acceptance checklist.

## Environment Variables

Create separate `.env.example` files for frontend and backend.

### Backend

```env
APP_ENV=development
APP_PORT=8080
APP_BASE_URL=http://localhost:8080
FRONTEND_URL=http://localhost:5173

POSTGRES_URL=postgres://avnadmin:password@host:port/defaultdb?sslmode=require

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=30

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=zumers-dev
```

### Frontend

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_BASE_URL=ws://localhost:8080
VITE_CLOUDINARY_CLOUD_NAME=
```

## Definition of Done

A task is only done when:

- Code is implemented
- The feature works locally
- Errors and edge cases are handled
- Authorization rules are enforced on the backend
- Relevant tests are added or manually verified
- Documentation or env examples are updated if needed
- No secrets are committed

## Current Project Status

| Area | Status | Notes |
| --- | --- | --- |
| Planning | Done | Initial roadmap and architecture decisions are documented |
| Frontend | Done | React frontend feature shell completed and production build verified |
| Backend | In Progress | Phase 3 backend APIs are implemented; tests and hardening phases remain |
| Database | Done | Aiven PostgreSQL connected and schema migration version 1 applied |
| Cloudinary | Done | Signed uploads, validation, progress UI, optimized image delivery, and video playback are implemented |
| Deployment | Not Started | No production deployment yet |



