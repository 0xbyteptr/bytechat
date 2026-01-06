package groups

import (
	"encoding/json"
	"net/http"
	"strings"

	"bytechat/auth"
	"bytechat/models"
	"bytechat/storage"
)

// Handler handles group operations
func Handler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	token := auth.GetTokenFromRequest(r)
	if id == "" || !auth.IsValidToken(id, token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	switch r.Method {
	case http.MethodPost:
		var g models.Group
		if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if !strings.HasPrefix(g.ID, "#") {
			http.Error(w, "group id must start with #", http.StatusBadRequest)
			return
		}

		if existing, exists := storage.GetGroup(g.ID); exists {
			if existing.Admin != id {
				http.Error(w, "only admin can update group", http.StatusForbidden)
				return
			}
			existing.Members = g.Members
			if g.Name != "" {
				existing.Name = g.Name
			}
			storage.SetGroup(g.ID, existing)
		} else {
			g.Admin = id
			found := false
			for _, m := range g.Members {
				if m == id {
					found = true
					break
				}
			}
			if !found {
				g.Members = append(g.Members, id)
			}
			storage.SetGroup(g.ID, g)
		}

		storage.SaveGroups()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})

	case http.MethodGet:
		myGroups := storage.GetUserGroups(id)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(myGroups)
	}
}
