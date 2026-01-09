package friends

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"bytechat/auth"
	"bytechat/models"
	"bytechat/storage"
)

// Handler manages friend requests and operations
func Handler(w http.ResponseWriter, r *http.Request) {
	// Get and verify user ID from headers
	userID := r.Header.Get("X-ByteChat-ID")
	token := auth.GetTokenFromRequest(r)

	if userID == "" || !auth.IsValidToken(userID, token) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		handleGet(w, r, userID)
	case http.MethodPost:
		handlePost(w, r, userID)
	case http.MethodDelete:
		handleDelete(w, r, userID)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleGet(w http.ResponseWriter, r *http.Request, userID string) {
	action := r.URL.Query().Get("action")

	switch action {
	case "list":
		getFriendsList(w, userID)
	case "requests":
		getFriendRequests(w, userID)
	case "pending":
		getPendingRequests(w, userID)
	default:
		http.Error(w, "Invalid action", http.StatusBadRequest)
	}
}

func handlePost(w http.ResponseWriter, r *http.Request, userID string) {
	action := r.URL.Query().Get("action")

	switch action {
	case "send-request":
		sendFriendRequest(w, r, userID)
	case "accept-request":
		acceptFriendRequest(w, r, userID)
	case "reject-request":
		rejectFriendRequest(w, r, userID)
	default:
		http.Error(w, "Invalid action", http.StatusBadRequest)
	}
}

func handleDelete(w http.ResponseWriter, r *http.Request, userID string) {
	action := r.URL.Query().Get("action")

	switch action {
	case "remove-friend":
		removeFriend(w, r, userID)
	case "cancel-request":
		cancelFriendRequest(w, r, userID)
	case "block-user":
		blockUser(w, r, userID)
	default:
		http.Error(w, "Invalid action", http.StatusBadRequest)
	}
}

// getFriendsList returns all friends for the user
func getFriendsList(w http.ResponseWriter, userID string) {
	db := storage.GetDB()
	rows, err := db.Query(`
		SELECT CASE 
			WHEN user_id_1 = $1 THEN user_id_2 
			ELSE user_id_1 
		END as friend_id, created_at
		FROM friends
		WHERE user_id_1 = $1 OR user_id_2 = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var friends []models.FriendResponse

	for rows.Next() {
		var friendID string
		var createdAt sql.NullTime
		if err := rows.Scan(&friendID, &createdAt); err != nil {
			continue
		}

		// Get friend's profile
		friendProfile, ok := storage.GetProfile(friendID)
		if !ok {
			continue
		}

		friends = append(friends, models.FriendResponse{
			User:      *friendProfile,
			IsFriend:  true,
			CreatedAt: createdAt.Time,
		})
	}

	if friends == nil {
		friends = []models.FriendResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(friends)
}

// getFriendRequests returns all incoming friend requests
func getFriendRequests(w http.ResponseWriter, userID string) {
	db := storage.GetDB()
	rows, err := db.Query(`
		SELECT id, from_id, to_id, status, created_at, updated_at
		FROM friend_requests
		WHERE to_id = $1 AND status = 'pending'
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var requests []map[string]interface{}

	for rows.Next() {
		var req models.FriendRequest
		if err := rows.Scan(&req.ID, &req.FromID, &req.ToID, &req.Status, &req.CreatedAt, &req.UpdatedAt); err != nil {
			continue
		}

		// Get requester's profile
		requesterProfile, ok := storage.GetProfile(req.FromID)
		if !ok {
			continue
		}

		requests = append(requests, map[string]interface{}{
			"id":        req.ID,
			"fromId":    req.FromID,
			"toId":      req.ToID,
			"status":    req.Status,
			"user":      *requesterProfile,
			"createdAt": req.CreatedAt,
		})
	}

	if requests == nil {
		requests = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// getPendingRequests returns outgoing friend requests sent by the user
func getPendingRequests(w http.ResponseWriter, userID string) {
	db := storage.GetDB()
	rows, err := db.Query(`
		SELECT id, from_id, to_id, status, created_at, updated_at
		FROM friend_requests
		WHERE from_id = $1 AND status = 'pending'
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var requests []map[string]interface{}

	for rows.Next() {
		var req models.FriendRequest
		if err := rows.Scan(&req.ID, &req.FromID, &req.ToID, &req.Status, &req.CreatedAt, &req.UpdatedAt); err != nil {
			continue
		}

		// Get recipient's profile
		recipientProfile, ok := storage.GetProfile(req.ToID)
		if !ok {
			continue
		}

		requests = append(requests, map[string]interface{}{
			"id":        req.ID,
			"fromId":    req.FromID,
			"toId":      req.ToID,
			"status":    req.Status,
			"user":      *recipientProfile,
			"createdAt": req.CreatedAt,
		})
	}

	if requests == nil {
		requests = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// sendFriendRequest creates a new friend request
func sendFriendRequest(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		ToID string `json:"toId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.ToID == "" || req.ToID == userID {
		http.Error(w, "Invalid recipient", http.StatusBadRequest)
		return
	}

	// Verify recipient exists
	recipientProfile, ok := storage.GetProfile(req.ToID)
	if !ok || recipientProfile.ID == "" {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	db := storage.GetDB()

	// Check if already friends
	var exists bool
	var err error
	id1, id2 := userID, req.ToID
	if id1 > id2 {
		id1, id2 = id2, id1
	}
	err = db.QueryRow(`SELECT EXISTS(SELECT 1 FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2)`, id1, id2).Scan(&exists)
	if err == nil && exists {
		http.Error(w, "Already friends", http.StatusConflict)
		return
	}

	// Check for existing request
	err = db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM friend_requests 
		WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1))
	`, userID, req.ToID).Scan(&exists)
	if err == nil && exists {
		http.Error(w, "Friend request already exists", http.StatusConflict)
		return
	}

	// Create friend request
	var requestID int64
	err = db.QueryRow(`
		INSERT INTO friend_requests (from_id, to_id, status)
		VALUES ($1, $2, 'pending')
		RETURNING id
	`, userID, req.ToID).Scan(&requestID)

	if err != nil {
		http.Error(w, "Failed to send request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":     requestID,
		"fromId": userID,
		"toId":   req.ToID,
		"status": "pending",
	})
}

// acceptFriendRequest accepts an incoming friend request
func acceptFriendRequest(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		RequestID int64  `json:"requestId"`
		FromID    string `json:"fromId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	// Verify the request exists and belongs to this user
	var fromID string
	err := db.QueryRow(`
		SELECT from_id FROM friend_requests
		WHERE id = $1 AND to_id = $2 AND status = 'pending'
	`, req.RequestID, userID).Scan(&fromID)
	if err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Create friendship (ensure consistent ordering)
	id1, id2 := fromID, userID
	if id1 > id2 {
		id1, id2 = id2, id1
	}

	_, err = tx.Exec(`
		INSERT INTO friends (user_id_1, user_id_2)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, id1, id2)
	if err != nil {
		http.Error(w, "Failed to create friendship", http.StatusInternalServerError)
		return
	}

	// Update request status
	_, err = tx.Exec(`
		UPDATE friend_requests
		SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, req.RequestID)
	if err != nil {
		http.Error(w, "Failed to update request", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to commit", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "accepted"})
}

// rejectFriendRequest rejects an incoming friend request
func rejectFriendRequest(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		RequestID int64 `json:"requestId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	// Update the request status to rejected
	result, err := db.Exec(`
		UPDATE friend_requests
		SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND to_id = $2
	`, req.RequestID, userID)

	if err != nil {
		http.Error(w, "Failed to reject request", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "rejected"})
}

// removeFriend removes a friend relationship
func removeFriend(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		FriendID string `json:"friendId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.FriendID == "" {
		http.Error(w, "Invalid friend ID", http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	// Ensure consistent ordering
	id1, id2 := userID, req.FriendID
	if id1 > id2 {
		id1, id2 = id2, id1
	}

	result, err := db.Exec(`
		DELETE FROM friends
		WHERE user_id_1 = $1 AND user_id_2 = $2
	`, id1, id2)

	if err != nil {
		http.Error(w, "Failed to remove friend", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "Friend not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "removed"})
}

// cancelFriendRequest cancels an outgoing friend request
func cancelFriendRequest(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		RequestID int64 `json:"requestId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	result, err := db.Exec(`
		DELETE FROM friend_requests
		WHERE id = $1 AND from_id = $2 AND status = 'pending'
	`, req.RequestID, userID)

	if err != nil {
		http.Error(w, "Failed to cancel request", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "cancelled"})
}

// blockUser blocks a user (prevents them from sending friend requests)
func blockUser(w http.ResponseWriter, r *http.Request, userID string) {
	var req struct {
		UserIDToBlock string `json:"userIdToBlock"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.UserIDToBlock == "" || req.UserIDToBlock == userID {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	// Set their friend request to blocked status
	_, err := db.Exec(`
		UPDATE friend_requests
		SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
		WHERE from_id = $1 AND to_id = $2
	`, req.UserIDToBlock, userID)

	if err != nil {
		http.Error(w, "Failed to block user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "blocked"})
}
