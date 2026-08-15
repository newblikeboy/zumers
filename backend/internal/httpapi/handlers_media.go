package httpapi

import (
	"context"
	"crypto/sha1"
	"database/sql"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type cloudinarySignRequest struct {
	Folder string `json:"folder"`
}

func (s *Server) handleCloudinarySignUpload(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Cloudinary.CloudName == "" || s.cfg.Cloudinary.APIKey == "" || s.cfg.Cloudinary.APISecret == "" {
		writeError(w, http.StatusServiceUnavailable, "cloudinary credentials are not configured")
		return
	}

	var req cloudinarySignRequest
	_ = decodeJSON(r, &req)

	folder := strings.TrimSpace(req.Folder)
	if folder == "" {
		folder = s.cfg.Cloudinary.UploadFolder
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	params := map[string]string{
		"folder":    folder,
		"timestamp": timestamp,
	}
	signature := cloudinarySignature(params, s.cfg.Cloudinary.APISecret)

	writeJSON(w, http.StatusOK, map[string]any{
		"cloud_name":            s.cfg.Cloudinary.CloudName,
		"api_key":               s.cfg.Cloudinary.APIKey,
		"folder":                folder,
		"timestamp":             timestamp,
		"signature":             signature,
		"allowed_mime_prefixes": []string{"image/", "video/"},
		"max_image_bytes":       s.cfg.Cloudinary.MaxImageBytes,
		"max_video_bytes":       s.cfg.Cloudinary.MaxVideoBytes,
		"max_video_seconds":     s.cfg.Cloudinary.MaxVideoSeconds,
	})
}

func cloudinarySignature(params map[string]string, apiSecret string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		if params[key] == "" {
			continue
		}
		parts = append(parts, key+"="+params[key])
	}

	raw := strings.Join(parts, "&") + apiSecret
	sum := sha1.Sum([]byte(raw))
	return fmt.Sprintf("%x", sum)
}

func (s *Server) getPostMediaByPostID(ctx context.Context, postIDs []int64) (map[int64][]postMediaResponse, error) {
	mediaByPostID := make(map[int64][]postMediaResponse)
	if len(postIDs) == 0 {
		return mediaByPostID, nil
	}

	placeholders := make([]string, 0, len(postIDs))
	args := make([]any, 0, len(postIDs))
	for index, postID := range postIDs {
		placeholders = append(placeholders, "$"+strconv.Itoa(index+1))
		args = append(args, postID)
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT post_id, id, media_type, cloudinary_public_id, secure_url,
		        thumbnail_url, width, height, duration_seconds, display_order
		 FROM post_media
		 WHERE post_id IN (`+strings.Join(placeholders, ",")+`)
		 ORDER BY post_id, display_order, id`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var postID int64
		var media postMediaResponse
		var thumbnailURL sql.NullString
		var width, height, duration sql.NullInt64
		err := rows.Scan(
			&postID,
			&media.ID,
			&media.MediaType,
			&media.CloudinaryPublicID,
			&media.SecureURL,
			&thumbnailURL,
			&width,
			&height,
			&duration,
			&media.DisplayOrder,
		)
		if err != nil {
			return nil, err
		}

		media.ThumbnailURL = nullableString(thumbnailURL)
		media.Width = nullableInt(width)
		media.Height = nullableInt(height)
		media.DurationSeconds = nullableInt(duration)
		mediaByPostID[postID] = append(mediaByPostID[postID], media)
	}

	return mediaByPostID, nil
}

func nullableInt(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}

	intValue := int(value.Int64)
	return &intValue
}
