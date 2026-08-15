package httpapi

import (
	"context"
	"database/sql"
)

func sortedUserPair(first int64, second int64) (int64, int64) {
	if first < second {
		return first, second
	}

	return second, first
}

func areFriends(ctx context.Context, db *sql.DB, userID int64, friendID int64) bool {
	firstID, secondID := sortedUserPair(userID, friendID)
	var exists bool
	err := db.QueryRowContext(
		ctx,
		`SELECT EXISTS (
		   SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2
		 )`,
		firstID,
		secondID,
	).Scan(&exists)
	if err != nil {
		return false
	}

	return exists
}
