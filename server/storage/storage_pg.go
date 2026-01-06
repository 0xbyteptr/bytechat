package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"bytechat/models"
)

// Keys management
func SaveKey(id, publicKey string) error {
	mu.Lock()
	defer mu.Unlock()

	query := `
		INSERT INTO public_keys (id, public_key) 
		VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE 
		SET public_key = $2
	`
	_, err := db.Exec(query, id, publicKey)
	return err
}

func GetKey(id string) (string, bool) {
	mu.RLock()
	defer mu.RUnlock()

	var publicKey string
	err := db.QueryRow("SELECT public_key FROM public_keys WHERE id = $1", id).Scan(&publicKey)
	if err == sql.ErrNoRows {
		return "", false
	}
	if err != nil {
		log.Printf("Error getting key: %v\n", err)
		return "", false
	}
	return publicKey, true
}

func KeyExists(id string) bool {
	mu.RLock()
	defer mu.RUnlock()

	var exists bool
	err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM public_keys WHERE id = $1)", id).Scan(&exists)
	if err != nil {
		log.Printf("Error checking key existence: %v\n", err)
		return false
	}
	return exists
}

func GetAllKeys() []string {
	mu.RLock()
	defer mu.RUnlock()

	rows, err := db.Query("SELECT id FROM public_keys")
	if err != nil {
		log.Printf("Error getting all keys: %v\n", err)
		return []string{}
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			log.Printf("Error scanning key: %v\n", err)
			continue
		}
		keys = append(keys, id)
	}
	return keys
}

// Sessions management
func SaveSession(id, token string) error {
	mu.Lock()
	defer mu.Unlock()

	query := `
		INSERT INTO sessions (id, token) 
		VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE 
		SET token = $2
	`
	_, err := db.Exec(query, id, token)
	return err
}

func GetSession(id string) (string, bool) {
	mu.RLock()
	defer mu.RUnlock()

	var token string
	err := db.QueryRow("SELECT token FROM sessions WHERE id = $1", id).Scan(&token)
	if err == sql.ErrNoRows {
		return "", false
	}
	if err != nil {
		log.Printf("Error getting session: %v\n", err)
		return "", false
	}
	return token, true
}

func DeleteSession(id string) error {
	mu.Lock()
	defer mu.Unlock()

	_, err := db.Exec("DELETE FROM sessions WHERE id = $1", id)
	return err
}

// Groups management
func SaveGroup(id string, group models.Group) error {
	mu.Lock()
	defer mu.Unlock()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert or update group
	query := `
		INSERT INTO groups (id, name, description, owner) 
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE 
		SET name = $2, description = $3, owner = $4
	`
	_, err = tx.Exec(query, id, group.Name, group.Description, group.Owner)
	if err != nil {
		return err
	}

	// Update settings
	settingsQuery := `
		INSERT INTO group_settings (group_id, is_public, allow_member_invite, require_approval)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (group_id) DO UPDATE
		SET is_public = $2, allow_member_invite = $3, require_approval = $4
	`
	_, err = tx.Exec(settingsQuery, id, group.Settings.Public, group.Settings.AllowMemberInvite, group.Settings.RequireApproval)
	if err != nil {
		return err
	}

	// Clear existing members
	_, err = tx.Exec("DELETE FROM group_members WHERE group_id = $1", id)
	if err != nil {
		return err
	}

	// Insert members
	for _, member := range group.Members {
		_, err = tx.Exec("INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)", id, member)
		if err != nil {
			return err
		}
	}

	// Clear existing admins
	_, err = tx.Exec("DELETE FROM group_admins WHERE group_id = $1", id)
	if err != nil {
		return err
	}

	// Insert admins
	for _, admin := range group.Admins {
		_, err = tx.Exec("INSERT INTO group_admins (group_id, user_id) VALUES ($1, $2)", id, admin)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func GetGroup(id string) (*models.Group, error) {
	mu.RLock()
	defer mu.RUnlock()

	var group models.Group
	var description sql.NullString

	err := db.QueryRow(`
		SELECT g.id, g.name, g.description, g.owner, g.created_at,
		       COALESCE(gs.is_public, false),
		       COALESCE(gs.allow_member_invite, false),
		       COALESCE(gs.require_approval, false)
		FROM groups g
		LEFT JOIN group_settings gs ON g.id = gs.group_id
		WHERE g.id = $1
	`, id).Scan(&group.ID, &group.Name, &description, &group.Owner, &group.CreatedAt,
		&group.Settings.Public, &group.Settings.AllowMemberInvite, &group.Settings.RequireApproval)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("group not found")
	}
	if err != nil {
		return nil, err
	}

	if description.Valid {
		group.Description = description.String
	}

	// Get members
	rows, err := db.Query("SELECT user_id FROM group_members WHERE group_id = $1", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var member string
		if err := rows.Scan(&member); err != nil {
			continue
		}
		group.Members = append(group.Members, member)
	}

	// Get admins
	rows, err = db.Query("SELECT user_id FROM group_admins WHERE group_id = $1", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var admin string
		if err := rows.Scan(&admin); err != nil {
			continue
		}
		group.Admins = append(group.Admins, admin)
	}

	return &group, nil
}

func DeleteGroup(id string) error {
	mu.Lock()
	defer mu.Unlock()

	_, err := db.Exec("DELETE FROM groups WHERE id = $1", id)
	return err
}

func GetUserGroups(userID string) []models.Group {
	mu.RLock()
	defer mu.RUnlock()

	rows, err := db.Query(`
		SELECT g.id, g.name, g.description, g.owner, g.created_at,
		       COALESCE(gs.is_public, false),
		       COALESCE(gs.allow_member_invite, false),
		       COALESCE(gs.require_approval, false)
		FROM groups g
		LEFT JOIN group_settings gs ON g.id = gs.group_id
		WHERE g.id IN (
			SELECT group_id FROM group_members WHERE user_id = $1
		)
	`, userID)

	if err != nil {
		log.Printf("Error getting user groups: %v\n", err)
		return []models.Group{}
	}
	defer rows.Close()

	var groups []models.Group
	for rows.Next() {
		var group models.Group
		var description sql.NullString

		if err := rows.Scan(&group.ID, &group.Name, &description, &group.Owner, &group.CreatedAt,
			&group.Settings.Public, &group.Settings.AllowMemberInvite, &group.Settings.RequireApproval); err != nil {
			log.Printf("Error scanning group: %v\n", err)
			continue
		}

		if description.Valid {
			group.Description = description.String
		}

		// Get members for this group
		memberRows, err := db.Query("SELECT user_id FROM group_members WHERE group_id = $1", group.ID)
		if err == nil {
			for memberRows.Next() {
				var member string
				if err := memberRows.Scan(&member); err == nil {
					group.Members = append(group.Members, member)
				}
			}
			memberRows.Close()
		}

		// Get admins for this group
		adminRows, err := db.Query("SELECT user_id FROM group_admins WHERE group_id = $1", group.ID)
		if err == nil {
			for adminRows.Next() {
				var admin string
				if err := adminRows.Scan(&admin); err == nil {
					group.Admins = append(group.Admins, admin)
				}
			}
			adminRows.Close()
		}

		groups = append(groups, group)
	}

	return groups
}

func GetAllGroupIDs(userID string) []string {
	mu.RLock()
	defer mu.RUnlock()

	rows, err := db.Query("SELECT group_id FROM group_members WHERE user_id = $1", userID)
	if err != nil {
		log.Printf("Error getting user group IDs: %v\n", err)
		return []string{}
	}
	defer rows.Close()

	var groupIDs []string
	for rows.Next() {
		var groupID string
		if err := rows.Scan(&groupID); err != nil {
			continue
		}
		groupIDs = append(groupIDs, groupID)
	}
	return groupIDs
}

// Message history management
func SaveToHistory(id string, sm models.StoredMessage) error {
	mu.Lock()
	defer mu.Unlock()

	msgJSON, err := json.Marshal(sm.Msg)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO message_history (from_id, to_id, message, timestamp)
		VALUES ($1, $2, $3, $4)
	`
	_, err = db.Exec(query, sm.From, id, msgJSON, sm.Ts)
	return err
}

func GetHistory(id string) []models.StoredMessage {
	mu.RLock()
	defer mu.RUnlock()

	rows, err := db.Query(`
		SELECT from_id, to_id, message, timestamp
		FROM message_history
		WHERE to_id = $1
		ORDER BY timestamp ASC
	`, id)

	if err != nil {
		log.Printf("Error getting history: %v\n", err)
		return []models.StoredMessage{}
	}
	defer rows.Close()

	var history []models.StoredMessage
	for rows.Next() {
		var sm models.StoredMessage
		var msgJSON string

		if err := rows.Scan(&sm.From, &sm.To, &msgJSON, &sm.Ts); err != nil {
			log.Printf("Error scanning message: %v\n", err)
			continue
		}

		if err := json.Unmarshal([]byte(msgJSON), &sm.Msg); err != nil {
			log.Printf("Error unmarshaling message: %v\n", err)
			continue
		}

		history = append(history, sm)
	}

	return history
}

// Push tokens management
func SavePushToken(id, token string) error {
	mu.Lock()
	defer mu.Unlock()

	query := `
		INSERT INTO push_tokens (id, token)
		VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE
		SET token = $2
	`
	_, err := db.Exec(query, id, token)
	return err
}

func GetPushToken(id string) (string, bool) {
	mu.RLock()
	defer mu.RUnlock()

	var token string
	err := db.QueryRow("SELECT token FROM push_tokens WHERE id = $1", id).Scan(&token)
	if err == sql.ErrNoRows {
		return "", false
	}
	if err != nil {
		log.Printf("Error getting push token: %v\n", err)
		return "", false
	}
	return token, true
}
