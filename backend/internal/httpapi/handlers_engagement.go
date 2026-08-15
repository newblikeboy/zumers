package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
)

type reactionRequest struct {
	ReactionType string `json:"reaction_type"`
}

type commentCreateRequest struct {
	Content string `json:"content"`
}

type sharePostRequest struct {
	Content    *string `json:"content"`
	Visibility string  `json:"visibility"`
}

type commentResponse struct {
	ID        int64         `json:"id"`
	PostID    int64         `json:"post_id"`
	AuthorID  int64         `json:"author_id"`
	Author    *userResponse `json:"author,omitempty"`
	Content   string        `json:"content"`
	CreatedAt string        `json:"created_at"`
	UpdatedAt string        `json:"updated_at"`
}

func (s *Server) handlePostReactionSet(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}
	if !s.canViewPost(r.Context(), currentUserID(r), postID) {
		writeError(w, http.StatusForbidden, "post is not visible")
		return
	}

	var req reactionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	reactionType := cleanReactionType(req.ReactionType)

	_, err = s.db.ExecContext(
		r.Context(),
		`INSERT INTO post_reactions (post_id, user_id, reaction_type)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (post_id, user_id)
		 DO UPDATE SET reaction_type = EXCLUDED.reaction_type, updated_at = CURRENT_TIMESTAMP`,
		postID,
		currentUserID(r),
		reactionType,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save reaction")
		return
	}

	authorID, _ := s.postAuthorID(r.Context(), postID)
	if authorID != 0 && authorID != currentUserID(r) {
		_ = createNotification(r.Context(), s.db, authorID, currentUserID(r), "post_reaction", "post", postID)
	}

	post, err := s.getPost(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load post")
		return
	}
	writeJSON(w, http.StatusOK, post)
}

func (s *Server) handlePostReactionDelete(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}

	_, err = s.db.ExecContext(r.Context(), `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`, postID, currentUserID(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove reaction")
		return
	}

	post, err := s.getPost(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load post")
		return
	}
	writeJSON(w, http.StatusOK, post)
}

func (s *Server) handlePostCommentsList(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}
	if !s.canViewPost(r.Context(), currentUserID(r), postID) {
		writeError(w, http.StatusForbidden, "post is not visible")
		return
	}

	rows, err := s.db.QueryContext(
		r.Context(),
		`SELECT id, post_id, author_id, content, created_at::text, updated_at::text
		 FROM comments
		 WHERE post_id = $1 AND deleted_at IS NULL
		 ORDER BY created_at ASC
		 LIMIT $2`,
		postID,
		pageLimit(r, 50, 100),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load comments")
		return
	}
	defer rows.Close()

	comments := make([]commentResponse, 0)
	for rows.Next() {
		var comment commentResponse
		if err := rows.Scan(&comment.ID, &comment.PostID, &comment.AuthorID, &comment.Content, &comment.CreatedAt, &comment.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read comments")
			return
		}
		author, err := s.getUserResponse(r.Context(), comment.AuthorID)
		if err == nil {
			comment.Author = &author
		}
		comments = append(comments, comment)
	}

	writeJSON(w, http.StatusOK, map[string]any{"comments": comments})
}

func (s *Server) handlePostCommentCreate(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}
	if !s.canViewPost(r.Context(), currentUserID(r), postID) {
		writeError(w, http.StatusForbidden, "post is not visible")
		return
	}

	var req commentCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		writeError(w, http.StatusBadRequest, "comment content is required")
		return
	}

	var comment commentResponse
	err = s.db.QueryRowContext(
		r.Context(),
		`INSERT INTO comments (post_id, author_id, content)
		 VALUES ($1, $2, $3)
		 RETURNING id, post_id, author_id, content, created_at::text, updated_at::text`,
		postID,
		currentUserID(r),
		content,
	).Scan(&comment.ID, &comment.PostID, &comment.AuthorID, &comment.Content, &comment.CreatedAt, &comment.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create comment")
		return
	}
	author, err := s.getUserResponse(r.Context(), comment.AuthorID)
	if err == nil {
		comment.Author = &author
	}

	authorID, _ := s.postAuthorID(r.Context(), postID)
	if authorID != 0 && authorID != currentUserID(r) {
		_ = createNotification(r.Context(), s.db, authorID, currentUserID(r), "post_comment", "comment", comment.ID)
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (s *Server) handleCommentDelete(w http.ResponseWriter, r *http.Request) {
	commentID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid comment id")
		return
	}

	result, err := s.db.ExecContext(
		r.Context(),
		`UPDATE comments
		 SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND author_id = $2 AND deleted_at IS NULL`,
		commentID,
		currentUserID(r),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete comment")
		return
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		writeError(w, http.StatusNotFound, "comment not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handlePostShare(w http.ResponseWriter, r *http.Request) {
	postID, err := parseID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid post id")
		return
	}
	if !s.canViewPost(r.Context(), currentUserID(r), postID) {
		writeError(w, http.StatusForbidden, "post is not visible")
		return
	}

	var req sharePostRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	content := cleanOptionalText(req.Content)
	visibility := cleanVisibility(req.Visibility)
	var sharedID int64
	err = s.db.QueryRowContext(
		r.Context(),
		`INSERT INTO posts (author_id, content, visibility, shared_post_id)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		currentUserID(r),
		content,
		visibility,
		postID,
	).Scan(&sharedID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not share post")
		return
	}

	authorID, _ := s.postAuthorID(r.Context(), postID)
	if authorID != 0 && authorID != currentUserID(r) {
		_ = createNotification(r.Context(), s.db, authorID, currentUserID(r), "post_share", "post", sharedID)
	}

	post, err := s.getPost(r.Context(), sharedID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load shared post")
		return
	}
	writeJSON(w, http.StatusCreated, post)
}

func (s *Server) addPostEngagement(ctx context.Context, viewerID int64, posts []*postResponse) error {
	for _, post := range posts {
		if post == nil {
			continue
		}
		if err := s.db.QueryRowContext(
			ctx,
			`SELECT
			   (SELECT COUNT(*) FROM post_reactions WHERE post_id = $1),
			   (SELECT COUNT(*) FROM comments WHERE post_id = $1 AND deleted_at IS NULL),
			   (SELECT COUNT(*) FROM posts WHERE shared_post_id = $1 AND deleted_at IS NULL),
			   (SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1)`,
			post.ID,
			viewerID,
		).Scan(&post.LikeCount, &post.CommentCount, &post.ShareCount, &nullableReaction{target: &post.ViewerReaction}); err != nil {
			return err
		}
	}
	return nil
}

type nullableReaction struct {
	target **string
}

func (n *nullableReaction) Scan(value any) error {
	if value == nil {
		*n.target = nil
		return nil
	}
	switch typed := value.(type) {
	case string:
		*n.target = &typed
	case []byte:
		value := string(typed)
		*n.target = &value
	default:
		return errors.New("invalid reaction value")
	}
	return nil
}

func (s *Server) canViewPost(ctx context.Context, viewerID int64, postID int64) bool {
	var authorID int64
	var visibility string
	err := s.db.QueryRowContext(ctx, `SELECT author_id, visibility FROM posts WHERE id = $1 AND deleted_at IS NULL`, postID).Scan(&authorID, &visibility)
	if err != nil {
		return false
	}
	if viewerID == authorID || visibility == "public" {
		return true
	}
	return visibility == "friends" && areFriends(ctx, s.db, viewerID, authorID)
}

func (s *Server) postAuthorID(ctx context.Context, postID int64) (int64, error) {
	var authorID int64
	err := s.db.QueryRowContext(ctx, `SELECT author_id FROM posts WHERE id = $1 AND deleted_at IS NULL`, postID).Scan(&authorID)
	return authorID, err
}

func (s *Server) getPostForViewer(ctx context.Context, postID int64, viewerID int64, includeShared bool) (postResponse, error) {
	if !s.canViewPost(ctx, viewerID, postID) {
		return postResponse{}, sql.ErrNoRows
	}
	post, err := s.getPost(ctx, postID)
	if err != nil {
		return postResponse{}, err
	}
	if !includeShared {
		post.SharedPost = nil
	}
	return post, nil
}

func cleanReactionType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "love", "care", "haha", "wow", "sad", "angry":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "like"
	}
}
