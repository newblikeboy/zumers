package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv      string
	Port        string
	AppBaseURL  string
	FrontendURL string
	Postgres    PostgresConfig
	JWT         JWTConfig
	Cloudinary  CloudinaryConfig
}

type PostgresConfig struct {
	URL string
}

type JWTConfig struct {
	AccessSecret     string
	RefreshSecret    string
	AccessTTLMinutes string
	RefreshTTLDays   string
}

type CloudinaryConfig struct {
	CloudName       string
	APIKey          string
	APISecret       string
	UploadFolder    string
	MaxImageBytes   int64
	MaxVideoBytes   int64
	MaxVideoSeconds int
}

func Load() Config {
	loadDotEnv()

	return Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		Port:        getEnv("APP_PORT", "8080"),
		AppBaseURL:  getEnv("APP_BASE_URL", "http://localhost:8080"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
		Postgres: PostgresConfig{
			URL: getEnv("POSTGRES_URL", ""),
		},
		JWT: JWTConfig{
			AccessSecret:     getEnv("JWT_ACCESS_SECRET", ""),
			RefreshSecret:    getEnv("JWT_REFRESH_SECRET", ""),
			AccessTTLMinutes: getEnv("JWT_ACCESS_TTL_MINUTES", "15"),
			RefreshTTLDays:   getEnv("JWT_REFRESH_TTL_DAYS", "30"),
		},
		Cloudinary: CloudinaryConfig{
			CloudName:       getEnv("CLOUDINARY_CLOUD_NAME", ""),
			APIKey:          getEnv("CLOUDINARY_API_KEY", ""),
			APISecret:       getEnv("CLOUDINARY_API_SECRET", ""),
			UploadFolder:    getEnv("CLOUDINARY_UPLOAD_FOLDER", "zumers-dev"),
			MaxImageBytes:   getEnvInt64("CLOUDINARY_MAX_IMAGE_BYTES", 10*1024*1024),
			MaxVideoBytes:   getEnvInt64("CLOUDINARY_MAX_VIDEO_BYTES", 200*1024*1024),
			MaxVideoSeconds: getEnvInt("CLOUDINARY_MAX_VIDEO_SECONDS", 300),
		},
	}
}

func loadDotEnv() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func getEnvInt(key string, fallback int) int {
	value, err := strconv.Atoi(getEnv(key, ""))
	if err != nil {
		return fallback
	}
	return value
}

func getEnvInt64(key string, fallback int64) int64 {
	value, err := strconv.ParseInt(getEnv(key, ""), 10, 64)
	if err != nil {
		return fallback
	}
	return value
}
