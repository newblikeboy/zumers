# Zumers Backend

Go API service for the Zumers social networking application.

## Current Scope

Phase 1 and Phase 2 backend foundation includes:

- Go module
- API entry point
- Environment-based configuration
- Health endpoints
- Basic CORS middleware
- PostgreSQL connection setup
- Goose migration command

## Local Development

Run the API:

```bash
go run ./cmd/api
```

The API defaults to:

```text
http://localhost:8080
```

Health checks:

```text
GET /healthz
GET /api/v1/health
```

## Database Migrations

Set the PostgreSQL URI from Aiven first.

Aiven normally provides this as a service URI. Keep `sslmode=require` in the URI.

The backend automatically loads `.env` from this folder during local development.

```bash
set POSTGRES_URL=postgres://avnadmin:your-password@your-aiven-host:your-aiven-port/defaultdb?sslmode=require
```

Run migrations:

```bash
go run ./cmd/migrate up
```

Check migration status:

```bash
go run ./cmd/migrate status
```

Validate migration files without connecting to PostgreSQL:

```bash
go run ./cmd/migrate validate
```

Rollback one migration:

```bash
go run ./cmd/migrate down
```

Local seed data is stored in `seeds/local_seed.sql`. Apply it only to a local or disposable development database.

## API Reference

See `../docs/API.md` for current Phase 3 routes and request shapes.

## Cloudinary

Local development expects Cloudinary values in `.env`:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=zumers-dev
CLOUDINARY_MAX_IMAGE_BYTES=10485760
CLOUDINARY_MAX_VIDEO_BYTES=209715200
CLOUDINARY_MAX_VIDEO_SECONDS=300
```

The API signs uploads through `/api/v1/media/sign-upload`. The frontend uploads directly to Cloudinary and sends returned public IDs/URLs back to the backend with posts or profile updates.
