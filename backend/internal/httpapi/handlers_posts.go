package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type postMediaRequest struct {
	MediaType          string  `json:"media_type"`
	CloudinaryPublicID string  `json:"cloudinary_public_id"`
	SecureURL          string  `json:"secure_url"`
	ThumbnailURL       *string `json:"thumbnail_url"`
	Width              *int    `json:"width"`
	Height             *int    `json:"height"`
	DurationSeconds    *int    `json:"duration_seconds"`
	DisplayOrder       int     `json:"display_order"`
}

type postCreateRequest struct {
	Content    *string            `json:"content"`
	Visibility string             `json:"visibility"`
	Media      []postMediaRequest `json:"media"`
}

type postUpdateRequest struct {
	Content    *string `json:"content"`
	Visibility *string `json:"visibility"`
}

type postResponse struct {
	ID             int64               `json:"id"`
	AuthorID       int64               `json:"author_id"`
	Author         *userResponse       `json:"author,omitempty"`
	Content        *string             `json:"content,omitempty"`
	Visibility     string              `json:"visibility"`
	SharedPostID   *int64              `json:"shared_post_id,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
	Media          []postMediaResponse `json:"media"`
	LikeCount      int64               `json:"like_count"`
	CommentCount   int64               `json:"comment_count"`
	ShareCount     int64               `json:"share_count"`
	ViewerReaction *string             `json:"viewer_reaction,omitempty"`
	SharedPost     *postResponse       `json:"shared_post,omitempty"`
}

type postMediaResponse struct {
	ID                 int64   `json:"id"`
	MediaType          string  `json:"media_type"`
	CloudinaryPublicID string  `json:"cloudinary_public_id"`
	SecureURL          string  `json:"secure_url"`
	ThumbnailURL       *string `json:"thumbnail_url,omitempty"`
	Width              *int    `json:"width,omitempty"`
	Height             *int    `json:"height,omitempty"`
	DurationSeconds    *int    `json:"duration_seconds,omitempty"`
	DisplayOrder       int     `json:"display_order"`
}

func (s *Server) handlePostCreate(w http.ResponseWriter, r *http.Request) {
	var req postCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	content := cleanOptionalText(req.Content)
	visibility := cleanVisibility(req.Visibility)
	if content == nil && len(req.Media) == 0 {
		writeError(w, http.StatusBadRequest, "content or media is required")
		return
	}
	if err := validateMedia(req.Media); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create post")
		return
	}
	defer tx.Rollback()

	var postID int64
	err = tx.QueryRowContext(
		r.Context(),
		`INSERT INTO posts (author_id, content, visibility)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		currentUserID(r),
		content,
		visibility,
	).Scan(&postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create post")
		return
	}

	for _, media := range req.Media {
		_, err = tx.ExecContext(
			r.Context(),
			`INSERT INTO post_media
			   (post_id, media_type, cloudinary_public_id, secure_url, thumbnail_url, width, height, duration_seconds, display_order)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			postID,
			media.MediaType,
			media.CloudinaryPublicID,
			media.SecureURL,
			media.ThumbnailURL,
			media.Width,
			media.Height,
			media.DurationSeconds,
			media.DisplayOrder,
		)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid media metadata")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create post")
		return
	}

	post, err := s.getPost(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load post")
		return
	}

	writeJSON(w, http.StatusCreated, post)
}

func (s *Server) handleFeed(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(r)
	posts, err := s.listPosts(
		r,
		`p.deleted_at IS NULL
		 AND (
		   p.author_id = $1
		   OR p.visibility = 'public'
		   OR EXISTS (
		     SELECT 1 FROM friendships f
		     WHERE ((f.user_id = $1 AND f.friend_id = p.author_id) OR (f.friend_id = $1 AND f.user_id = p.author_id))
		       AND p.visibility = 'friends'
		   )
		 )`,
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load feed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func (s *Server) handleReels(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(r)
	posts, err := s.listPosts(
		r,
		`p.deleted_at IS NULL
		 AND EXISTS (
		   SELECT 1 FROM post_media pm
		   WHERE pm.media_type = 'video'
		     AND (pm.post_id = p.id OR pm.post_id = p.shared_post_id)
		 )
		 AND (
		   p.author_id = $1
		   OR p.visibility = 'public'
		   OR EXISTS (
		     SELECT 1 FROM friendships f
		     WHERE ((f.user_id = $1 AND f.friend_id = p.author_id) OR (f.friend_id = $1 AND f.user_id = p.author_id))
		       AND p.visibility = 'friends'
		   )
		 )`,
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load reels")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func (s *Server) handleUserPosts(w http.ResponseWriter, r *http.Request) {
	profileUserID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if !s.canViewProfile(r.Context(), currentUserID(r), profileUserID) {
		writeError(w, http.StatusForbidden, "profile is not visible")
		return
	}

	viewerID := currentUserID(r)
	posts, err := s.listPosts(
		r,
		`p.deleted_at IS NULL
		 AND p.author_id = $1
		 AND (
		   p.author_id = $2
		   OR p.visibility = 'public'
		   OR (p.visibility = 'friends' AND EXISTS (
		     SELECT 1 FROM friendships f
		     WHERE (f.user_id = $1 AND f.friend_id = $2) OR (f.friend_id = $1 AND f.user_id = $2)
		   ))
		 )`,
		profileUserID,
		viewerID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load posts")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"posts": posts})
}

func (s *Server) handlePostUpdate(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}

	var req postUpdateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	content := cleanOptionalText(req.Content)
	var visibility *string
	if req.Visibility != nil {
		value := cleanVisibility(*req.Visibility)
		visibility = &value
	}

	result, err := s.db.ExecContext(
		r.Context(),
		`UPDATE posts
		 SET content = COALESCE($1, content),
		     visibility = COALESCE($2, visibility),
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = $3 AND author_id = $4 AND deleted_at IS NULL`,
		content,
		visibility,
		postID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update post")
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}

	post, err := s.getPost(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load post")
		return
	}

	writeJSON(w, http.StatusOK, post)
}

func (s *Server) handlePostDelete(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}

	result, err := s.db.ExecContext(
		r.Context(),
		`UPDATE posts
		 SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
		postID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete post")
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "post not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) getPost(ctx context.Context, postID int64) (postResponse, error) {
	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, author_id, content, visibility, shared_post_id, created_at, updated_at
		 FROM posts
		 WHERE id = $1 AND deleted_at IS NULL`,
		postID,
	)
	post, err := scanPost(row)
	if err != nil {
		return postResponse{}, err
	}

	mediaByPostID, err := s.getPostMediaByPostID(ctx, []int64{post.ID})
	if err != nil {
		return postResponse{}, err
	}
	post.Media = mediaByPostID[post.ID]
	author, err := s.getUserResponse(ctx, post.AuthorID)
	if err == nil {
		post.Author = &author
	}
	if err := s.addPostEngagement(ctx, currentUserIDFromContext(ctx), []*postResponse{&post}); err != nil {
		return postResponse{}, err
	}
	if post.SharedPostID != nil {
		shared, err := s.getPostForViewer(ctx, *post.SharedPostID, currentUserIDFromContext(ctx), false)
		if err == nil {
			post.SharedPost = &shared
		}
	}

	return post, nil
}

func (s *Server) listPosts(r *http.Request, condition string, args ...any) ([]postResponse, error) {
	limit := pageLimit(r, 50, 100)
	queryArgs := append(args, limit)
	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT p.id, p.author_id, p.content, p.visibility, p.shared_post_id, p.created_at, p.updated_at
		 FROM posts p
		 WHERE `+condition+`
		 ORDER BY p.created_at DESC
		 LIMIT $`+strconv.Itoa(len(queryArgs)),
		queryArgs...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := make([]postResponse, 0)
	postIDs := make([]int64, 0)
	authorIDs := make([]int64, 0)
	for rows.Next() {
		post, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
		postIDs = append(postIDs, post.ID)
		authorIDs = append(authorIDs, post.AuthorID)
	}

	mediaByPostID, err := s.getPostMediaByPostID(r.Context(), postIDs)
	if err != nil {
		return nil, err
	}
	authorsByID, err := s.getUserResponsesByID(r.Context(), authorIDs)
	if err != nil {
		return nil, err
	}

	for index := range posts {
		posts[index].Media = mediaByPostID[posts[index].ID]
		if author, ok := authorsByID[posts[index].AuthorID]; ok {
			posts[index].Author = &author
		}
	}
	postPointers := make([]*postResponse, 0, len(posts))
	for index := range posts {
		postPointers = append(postPointers, &posts[index])
	}
	if err := s.addPostEngagement(r.Context(), currentUserID(r), postPointers); err != nil {
		return nil, err
	}
	sharedPostIDs := make([]int64, 0)
	seenSharedPostIDs := make(map[int64]struct{})
	for index := range posts {
		if posts[index].SharedPostID == nil {
			continue
		}
		sharedID := *posts[index].SharedPostID
		if _, exists := seenSharedPostIDs[sharedID]; exists {
			continue
		}
		seenSharedPostIDs[sharedID] = struct{}{}
		sharedPostIDs = append(sharedPostIDs, sharedID)
	}
	sharedPostsByID, err := s.getPostsForViewerByID(r.Context(), sharedPostIDs, currentUserID(r))
	if err != nil {
		return nil, err
	}
	for index := range posts {
		if posts[index].SharedPostID == nil {
			continue
		}
		if shared, ok := sharedPostsByID[*posts[index].SharedPostID]; ok {
			sharedCopy := shared
			posts[index].SharedPost = &sharedCopy
		}
	}

	return posts, nil
}

func (s *Server) getPostsForViewerByID(ctx context.Context, postIDs []int64, viewerID int64) (map[int64]postResponse, error) {
	postsByID := make(map[int64]postResponse)
	if len(postIDs) == 0 {
		return postsByID, nil
	}

	placeholders := make([]string, 0, len(postIDs))
	args := make([]any, 0, len(postIDs)+1)
	seen := make(map[int64]struct{}, len(postIDs))
	for _, postID := range postIDs {
		if postID <= 0 {
			continue
		}
		if _, exists := seen[postID]; exists {
			continue
		}
		seen[postID] = struct{}{}
		args = append(args, postID)
		placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
	}
	if len(args) == 0 {
		return postsByID, nil
	}
	viewerPlaceholder := "$" + strconv.Itoa(len(args)+1)
	args = append(args, viewerID)

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT p.id, p.author_id, p.content, p.visibility, p.shared_post_id, p.created_at, p.updated_at
		 FROM posts p
		 WHERE p.id IN (`+strings.Join(placeholders, ",")+`)
		   AND p.deleted_at IS NULL
		   AND (
		     p.author_id = `+viewerPlaceholder+`
		     OR p.visibility = 'public'
		     OR (
		       p.visibility = 'friends'
		       AND EXISTS (
		         SELECT 1 FROM friendships f
		         WHERE (f.user_id = `+viewerPlaceholder+` AND f.friend_id = p.author_id)
		            OR (f.friend_id = `+viewerPlaceholder+` AND f.user_id = p.author_id)
		       )
		     )
		   )`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := make([]postResponse, 0)
	loadedPostIDs := make([]int64, 0)
	authorIDs := make([]int64, 0)
	for rows.Next() {
		post, err := scanPost(rows)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
		loadedPostIDs = append(loadedPostIDs, post.ID)
		authorIDs = append(authorIDs, post.AuthorID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	mediaByPostID, err := s.getPostMediaByPostID(ctx, loadedPostIDs)
	if err != nil {
		return nil, err
	}
	authorsByID, err := s.getUserResponsesByID(ctx, authorIDs)
	if err != nil {
		return nil, err
	}
	postPointers := make([]*postResponse, 0, len(posts))
	for index := range posts {
		posts[index].Media = mediaByPostID[posts[index].ID]
		if author, ok := authorsByID[posts[index].AuthorID]; ok {
			posts[index].Author = &author
		}
		postPointers = append(postPointers, &posts[index])
	}
	if err := s.addPostEngagement(ctx, viewerID, postPointers); err != nil {
		return nil, err
	}
	for _, post := range posts {
		post.SharedPost = nil
		postsByID[post.ID] = post
	}

	return postsByID, nil
}

type postScanner interface {
	Scan(dest ...any) error
}

func scanPost(scanner postScanner) (postResponse, error) {
	var post postResponse
	var content sql.NullString
	var sharedPostID sql.NullInt64
	err := scanner.Scan(&post.ID, &post.AuthorID, &content, &post.Visibility, &sharedPostID, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return postResponse{}, err
	}

	post.Content = nullableString(content)
	post.SharedPostID = nullableInt64(sharedPostID)
	post.Media = make([]postMediaResponse, 0)

	return post, nil
}

func cleanOptionalText(value *string) *string {
	if value == nil {
		return nil
	}

	cleaned := strings.TrimSpace(*value)
	if cleaned == "" {
		return nil
	}

	return &cleaned
}

func cleanVisibility(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "public", "private":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "friends"
	}
}

func validateMedia(media []postMediaRequest) error {
	for _, item := range media {
		if item.MediaType != "image" && item.MediaType != "video" {
			return errors.New("media_type must be image or video")
		}
		if strings.TrimSpace(item.CloudinaryPublicID) == "" || strings.TrimSpace(item.SecureURL) == "" {
			return errors.New("cloudinary_public_id and secure_url are required for media")
		}
	}

	return nil
}
