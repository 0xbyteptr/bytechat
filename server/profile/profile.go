package profile

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"bytechat/auth"
	"bytechat/models"
	"bytechat/storage"
	"bytechat/websocket"
)

// StatusUpdateRequest represents a user status update
type StatusUpdateRequest struct {
	Status        string `json:"status"`
	CustomMessage string `json:"customMessage,omitempty"`
}

// Handler manages user profile CRUD (currently GET/PUT)
func Handler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		handleGet(w, r)
	case http.MethodPut:
		handlePut(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// StatusHandler handles user status updates
func StatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := auth.GetTokenFromRequest(r)
	userID := r.Header.Get("X-ByteChat-ID")

	if userID == "" || !auth.IsValidToken(userID, token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var statusReq StatusUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&statusReq); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	// Validate status value
	validStatuses := map[string]bool{"online": true, "away": true, "busy": true, "offline": true}
	if !validStatuses[statusReq.Status] {
		http.Error(w, "invalid status", http.StatusBadRequest)
		return
	}

	// Get existing profile
	profile, ok := storage.GetProfile(userID)
	if !ok {
		profile = &models.Profile{ID: userID}
	}

	// Update status fields
	profile.Status = statusReq.Status
	profile.CustomMessage = statusReq.CustomMessage
	profile.LastSeen = time.Now().UnixMilli()
	profile.UpdatedAt = time.Now()

	if err := storage.SaveProfile(*profile); err != nil {
		log.Printf("Failed to save profile status for %s: %v\n", userID, err)
		http.Error(w, "failed to save status", http.StatusInternalServerError)
		return
	}

	// Broadcast status update to all connected clients
	statusMsg := map[string]interface{}{
		"type":          "status-update",
		"from":          userID,
		"status":        profile.Status,
		"customMessage": profile.CustomMessage,
		"lastSeen":      profile.LastSeen,
	}
	websocket.BroadcastToAll(statusMsg)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "id query param required", http.StatusBadRequest)
		return
	}

	profile, ok := storage.GetProfile(id)
	if !ok {
		// Auto-create empty profile for users without one (handles existing users)
		emptyProfile := models.Profile{
			ID: id,
		}
		if err := storage.SaveProfile(emptyProfile); err != nil {
			http.Error(w, "failed to create profile", http.StatusInternalServerError)
			return
		}
		profile = &emptyProfile
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func handlePut(w http.ResponseWriter, r *http.Request) {
	token := auth.GetTokenFromRequest(r)

	var body models.Profile
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if body.ID == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}

	if !auth.IsValidToken(body.ID, token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if body.UpdatedAt.IsZero() {
		body.UpdatedAt = time.Now()
	}

	if err := storage.SaveProfile(body); err != nil {
		http.Error(w, "failed to save profile", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
