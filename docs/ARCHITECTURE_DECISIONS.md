# Architecture Decisions

## Phase 1 Decisions

| ID | Decision | Status | Reason |
| --- | --- | --- | --- |
| ADR-001 | Use REST APIs for core application actions | Accepted | Signup, profiles, friends, posts, and media metadata fit request/response flows well |
| ADR-002 | Use WebSocket for real-time chat | Accepted | Chat needs low-latency bidirectional communication |
| ADR-003 | Use JWT access tokens with refresh tokens | Accepted | Works well for React plus Go APIs and keeps protected routes stateless for the MVP |
| ADR-004 | Enforce 18+ validation on the backend | Accepted | Frontend validation can be bypassed |
| ADR-005 | Use signed Cloudinary uploads | Accepted | Keeps Cloudinary API secret on the backend and supports direct browser upload |

## API Versioning

Initial API routes will use the `/api/v1` prefix.

## Backend Package Direction

The backend starts with standard-library HTTP routing. A larger framework can be added later only if routing, middleware, or validation complexity justifies it.

## Authentication Direction

Planned authentication flow:

1. User signs up or logs in.
2. Backend validates credentials and age eligibility.
3. Backend returns a short-lived JWT access token.
4. Backend also issues a longer-lived refresh token.
5. Frontend uses the access token for API requests.
6. Frontend requests a new access token when the old one expires.

