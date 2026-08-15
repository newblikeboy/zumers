package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type profileUpdateRequest struct {
	DisplayName       *string `json:"display_name"`
	Username          *string `json:"username"`
	Bio               *string `json:"bio"`
	Location          *string `json:"location"`
	AvatarURL         *string `json:"avatar_url"`
	AvatarPublicID    *string `json:"avatar_public_id"`
	CoverURL          *string `json:"cover_url"`
	CoverPublicID     *string `json:"cover_public_id"`
	ProfileVisibility *string `json:"profile_visibility"`
}

func (s *Server) handleProfileView(w http.ResponseWriter, r *http.Request) {
	userID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if !s.canViewProfile(r.Context(), currentUserID(r), userID) {
		writeError(w, http.StatusForbidden, "profile is not visible")
		return
	}

	user, err := s.getUserResponse(r.Context(), userID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleProfileUpdate(w http.ResponseWriter, r *http.Request) {
	var req profileUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	userID := currentUserID(r)
	if req.DisplayName != nil {
		value := strings.TrimSpace(*req.DisplayName)
		if value == "" {
			writeError(w, http.StatusBadRequest, "display_name cannot be empty")
			return
		}
		req.DisplayName = &value
	}
	if req.Username != nil {
		value := strings.ToLower(strings.TrimSpace(*req.Username))
		if len(value) < 3 {
			writeError(w, http.StatusBadRequest, "username must be at least 3 characters")
			return
		}
		req.Username = &value
	}
	if req.ProfileVisibility != nil {
		value := strings.ToLower(strings.TrimSpace(*req.ProfileVisibility))
		if value != "public" && value != "friends" && value != "private" {
			writeError(w, http.StatusBadRequest, "profile_visibility must be public, friends, or private")
			return
		}
		req.ProfileVisibility = &value
	}

	_, err := s.db.ExecContext(
		r.Context(),
		`UPDATE profiles
		 SET display_name = COALESCE($1, display_name),
		     username = COALESCE($2, username),
		     bio = COALESCE($3, bio),
		     location = COALESCE($4, location),
		     avatar_url = COALESCE($5, avatar_url),
		     avatar_public_id = COALESCE($6, avatar_public_id),
		     cover_url = COALESCE($7, cover_url),
		     cover_public_id = COALESCE($8, cover_public_id),
		     profile_visibility = COALESCE($9, profile_visibility),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE user_id = $10`,
		req.DisplayName,
		req.Username,
		req.Bio,
		req.Location,
		req.AvatarURL,
		req.AvatarPublicID,
		req.CoverURL,
		req.CoverPublicID,
		req.ProfileVisibility,
		userID,
	)
	if err != nil {
		writeError(w, http.StatusConflict, "profile update failed")
		return
	}

	user, err := s.getUserResponse(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load profile")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleUserSearch(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(query) < 2 {
		writeError(w, http.StatusBadRequest, "q must be at least 2 characters")
		return
	}

	limit := pageLimit(r, 20, 50)
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT u.id, u.email, u.date_of_birth::text, u.account_status,
		        p.display_name, p.username, p.bio, p.location, p.avatar_url, p.avatar_public_id, p.cover_url, p.cover_public_id, p.profile_visibility,
		        u.created_at, u.updated_at
		 FROM users u
		 JOIN profiles p ON p.user_id = u.id
		 WHERE u.account_status = 'active'
		   AND (p.username ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
		 ORDER BY p.display_name
		 LIMIT $2`,
		query,
		limit,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not search users")
		return
	}
	defer rows.Close()

	users := make([]userResponse, 0)
	for rows.Next() {
		user, err := scanUserResponse(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read users")
			return
		}
		users = append(users, user)
	}

	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

func (s *Server) getUserResponse(ctx context.Context, userID int64) (userResponse, error) {
	return s.getUserResponseWith(ctx, s.db, userID)
}

func (s *Server) getUserResponsesByID(ctx context.Context, userIDs []int64) (map[int64]userResponse, error) {
	usersByID := make(map[int64]userResponse)
	if len(userIDs) == 0 {
		return usersByID, nil
	}

	seen := make(map[int64]struct{}, len(userIDs))
	args := make([]any, 0, len(userIDs))
	placeholders := make([]string, 0, len(userIDs))
	for _, userID := range userIDs {
		if _, exists := seen[userID]; exists {
			continue
		}
		seen[userID] = struct{}{}
		args = append(args, userID)
		placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT u.id, u.email, u.date_of_birth::text, u.account_status,
		        p.display_name, p.username, p.bio, p.location, p.avatar_url, p.avatar_public_id, p.cover_url, p.cover_public_id, p.profile_visibility,
		        u.created_at, u.updated_at
		 FROM users u
		 JOIN profiles p ON p.user_id = u.id
		 WHERE u.id IN (`+strings.Join(placeholders, ",")+`)`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		user, err := scanUserResponse(rows)
		if err != nil {
			return nil, err
		}
		usersByID[user.ID] = user
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return usersByID, nil
}

type queryRower interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (s *Server) getUserResponseWith(ctx context.Context, queryer queryRower, userID int64) (userResponse, error) {
	row := queryer.QueryRowContext(
		ctx,
		`SELECT u.id, u.email, u.date_of_birth::text, u.account_status,
		        p.display_name, p.username, p.bio, p.location, p.avatar_url, p.avatar_public_id, p.cover_url, p.cover_public_id, p.profile_visibility,
		        u.created_at, u.updated_at
		 FROM users u
		 JOIN profiles p ON p.user_id = u.id
		 WHERE u.id = $1`,
		userID,
	)

	return scanUserResponse(row)
}

type userScanner interface {
	Scan(dest ...any) error
}

func scanUserResponse(scanner userScanner) (userResponse, error) {
	var user userResponse
	var bio, location, avatarURL, avatarPublicID, coverURL, coverPublicID sql.NullString
	err := scanner.Scan(
		&user.ID,
		&user.Email,
		&user.DateOfBirth,
		&user.AccountStatus,
		&user.DisplayName,
		&user.Username,
		&bio,
		&location,
		&avatarURL,
		&avatarPublicID,
		&coverURL,
		&coverPublicID,
		&user.ProfileVisibility,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return userResponse{}, err
	}

	user.Bio = nullableString(bio)
	user.Location = nullableString(location)
	user.AvatarURL = nullableString(avatarURL)
	user.AvatarPublicID = nullableString(avatarPublicID)
	user.CoverURL = nullableString(coverURL)
	user.CoverPublicID = nullableString(coverPublicID)

	return user, nil
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}

	return &value.String
}

func (s *Server) canViewProfile(ctx context.Context, viewerID int64, profileUserID int64) bool {
	if viewerID == profileUserID {
		return true
	}

	var visibility string
	err := s.db.QueryRowContext(ctx, `SELECT profile_visibility FROM profiles WHERE user_id = $1`, profileUserID).Scan(&visibility)
	if err != nil {
		return false
	}

	switch visibility {
	case "public":
		return true
	case "friends":
		return areFriends(ctx, s.db, viewerID, profileUserID)
	default:
		return false
	}
}
