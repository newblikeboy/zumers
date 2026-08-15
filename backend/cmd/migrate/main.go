package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/pressly/goose/v3"

	"zumers/backend/internal/config"
	"zumers/backend/internal/database"
)

func main() {
	migrationsDir := flag.String("dir", "migrations", "path to migration files")
	flag.Parse()

	command := "status"
	if flag.NArg() > 0 {
		command = flag.Arg(0)
	}

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatalf("set migration dialect: %v", err)
	}

	if command == "validate" {
		migrations, err := goose.CollectMigrations(*migrationsDir, 0, goose.MaxVersion)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Printf("validated %d migration(s) in %s\n", len(migrations), *migrationsDir)
		return
	}

	db, err := open(ctx, cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	switch command {
	case "up":
		err = goose.Up(db, *migrationsDir)
	case "down":
		err = goose.Down(db, *migrationsDir)
	case "status":
		err = goose.Status(db, *migrationsDir)
	case "version":
		err = goose.Version(db, *migrationsDir)
	default:
		err = fmt.Errorf("unknown migration command %q; use up, down, status, version, or validate", command)
	}
	if err != nil {
		log.Fatal(err)
	}
}

func open(ctx context.Context, cfg config.Config) (*sql.DB, error) {
	db, err := database.OpenPostgres(ctx, cfg.Postgres)
	if err != nil {
		return nil, err
	}

	if os.Getenv("APP_ENV") == "" {
		fmt.Println("APP_ENV not set; using development defaults")
	}

	return db, nil
}
