package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"zumers/backend/internal/config"
)

func OpenPostgres(ctx context.Context, cfg config.PostgresConfig) (*sql.DB, error) {
	if err := validatePostgresConfig(cfg); err != nil {
		return nil, err
	}

	db, err := sql.Open("pgx", PostgresDSN(cfg))
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return db, nil
}

func PostgresDSN(cfg config.PostgresConfig) string {
	return cfg.URL
}

func validatePostgresConfig(cfg config.PostgresConfig) error {
	if cfg.URL == "" {
		return errors.New("POSTGRES_URL is required")
	}

	return nil
}
