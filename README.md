# Zumers

Zumers is a social networking web application for individual users aged 18 or older.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Go
- Database: PostgreSQL on Aiven Cloud
- Media: Cloudinary for photos, videos, and video streaming delivery

## Project Structure

```text
.
|-- backend
|   |-- cmd/api
|   |-- cmd/migrate
|   |-- internal
|   |-- migrations
|   `-- seeds
|-- docs
|-- frontend
|   `-- src
`-- PROJECT_ROADMAP.md
```

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

### Backend

```bash
cd backend
go run ./cmd/api
```

Backend URL:

```text
http://localhost:8080
```

Health endpoint:

```text
GET http://localhost:8080/healthz
```

## Tracking Work

Use [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) as the source of truth for what is planned, in progress, blocked, and complete.
