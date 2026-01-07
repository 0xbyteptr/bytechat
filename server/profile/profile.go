package profile

import (
	"encoding/json"
	"net/http"
	"time"

	"bytechat/auth"
	"bytechat/models"
	"bytechat/storage"
)

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

func handleGet(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "id query param required", http.StatusBadRequest)
		return
	}

	profile, ok := storage.GetProfile(id)
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
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
