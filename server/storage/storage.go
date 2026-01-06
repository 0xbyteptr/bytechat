package storage

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"bytechat/models"
)

const (
	DataDir    = "data"
	HistoryDir = "data/history"
	CDNDir     = "data/cdn"
)

var (
	keyStore      = make(map[string]string) // id -> publicKey (Base64 Nacl)
	keysMutex     = sync.RWMutex{}
	historyMux    = sync.Mutex{}
	sessionTokens = make(map[string]string) // id -> sessionToken
	sessionMux    = sync.RWMutex{}
	groups        = make(map[string]models.Group) // id -> Group
	groupsMux     = sync.RWMutex{}
	pushTokens    = make(map[string]string) // id -> fcmToken
	pushTokensMux = sync.RWMutex{}
)

// Init initializes the storage directories and loads data
func Init() error {
	// Ensure data directory exists
	if err := os.MkdirAll(DataDir, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(HistoryDir, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(CDNDir, 0755); err != nil {
		return err
	}

	// Load existing data
	loadKeys()
	loadPushTokens()
	loadGroups()
	loadSessions()

	return nil
}

// Keys management
func loadKeys() {
	files, err := os.ReadDir(DataDir)
	if err != nil {
		log.Printf("Error reading data directory: %v\n", err)
		return
	}

	keysMutex.Lock()
	defer keysMutex.Unlock()

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".pub") {
			id := strings.TrimSuffix(file.Name(), ".pub")
			content, err := os.ReadFile(filepath.Join(DataDir, file.Name()))
			if err != nil {
				log.Printf("Error reading key file %s: %v\n", file.Name(), err)
				continue
			}
			keyStore[id] = string(content)
		}
	}
	log.Printf("Loaded %d keys from %s\n", len(keyStore), DataDir)
}

func SaveKey(id, publicKey string) error {
	keysMutex.Lock()
	defer keysMutex.Unlock()
	if err := os.WriteFile(filepath.Join(DataDir, id+".pub"), []byte(publicKey), 0644); err != nil {
		return err
	}
	keyStore[id] = publicKey
	return nil
}

func GetKey(id string) (string, bool) {
	keysMutex.RLock()
	defer keysMutex.RUnlock()
	key, ok := keyStore[id]
	return key, ok
}

func KeyExists(id string) bool {
	keysMutex.RLock()
	defer keysMutex.RUnlock()
	_, exists := keyStore[id]
	return exists
}

func GetAllKeys() []string {
	keysMutex.RLock()
	defer keysMutex.RUnlock()
	keys := make([]string, 0, len(keyStore))
	for k := range keyStore {
		keys = append(keys, k)
	}
	return keys
}

// Sessions management
func loadSessions() {
	content, err := os.ReadFile(filepath.Join(DataDir, "sessions.json"))
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("Error reading sessions.json: %v\n", err)
		}
		return
	}
	sessionMux.Lock()
	if err := json.Unmarshal(content, &sessionTokens); err != nil {
		log.Printf("Error unmarshaling sessions.json: %v\n", err)
	}
	sessionMux.Unlock()
	log.Printf("Loaded %d sessions\n", len(sessionTokens))
}

func SaveSession(id, token string) {
	sessionMux.Lock()
	sessionTokens[id] = token
	data, _ := json.Marshal(sessionTokens)
	sessionMux.Unlock()
	if err := os.WriteFile(filepath.Join(DataDir, "sessions.json"), data, 0644); err != nil {
		log.Printf("Error saving sessions.json: %v\n", err)
	}
}

func GetSession(id string) (string, bool) {
	sessionMux.RLock()
	defer sessionMux.RUnlock()
	token, ok := sessionTokens[id]
	return token, ok
}

// Groups management
func loadGroups() {
	content, err := os.ReadFile(filepath.Join(DataDir, "groups.json"))
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("Error reading groups.json: %v\n", err)
		}
		return
	}
	groupsMux.Lock()
	if err := json.Unmarshal(content, &groups); err != nil {
		log.Printf("Error unmarshaling groups.json: %v\n", err)
	}
	groupsMux.Unlock()
	log.Printf("Loaded %d groups\n", len(groups))
}

func SaveGroups() {
	groupsMux.Lock()
	data, _ := json.Marshal(groups)
	groupsMux.Unlock()
	if err := os.WriteFile(filepath.Join(DataDir, "groups.json"), data, 0644); err != nil {
		log.Printf("Error saving groups.json: %v\n", err)
	}
}

func GetGroup(id string) (models.Group, bool) {
	groupsMux.RLock()
	defer groupsMux.RUnlock()
	group, ok := groups[id]
	return group, ok
}

func SetGroup(id string, group models.Group) {
	groupsMux.Lock()
	defer groupsMux.Unlock()
	groups[id] = group
}

func GetUserGroups(userID string) []models.Group {
	myGroups := make([]models.Group, 0)
	groupsMux.RLock()
	defer groupsMux.RUnlock()
	for _, g := range groups {
		for _, m := range g.Members {
			if m == userID {
				myGroups = append(myGroups, g)
				break
			}
		}
	}
	return myGroups
}

func GetAllGroupIDs(userID string) []string {
	memberGroups := make([]string, 0)
	groupsMux.RLock()
	defer groupsMux.RUnlock()
	for gid, g := range groups {
		for _, m := range g.Members {
			if m == userID {
				memberGroups = append(memberGroups, gid)
				break
			}
		}
	}
	return memberGroups
}

// Push tokens management
func loadPushTokens() {
	content, err := os.ReadFile(filepath.Join(DataDir, "push_tokens.json"))
	if err != nil {
		return
	}
	pushTokensMux.Lock()
	json.Unmarshal(content, &pushTokens)
	pushTokensMux.Unlock()
}

func SavePushToken(id, token string) {
	pushTokensMux.Lock()
	pushTokens[id] = token
	data, _ := json.Marshal(pushTokens)
	pushTokensMux.Unlock()
	os.WriteFile(filepath.Join(DataDir, "push_tokens.json"), data, 0644)
}

func GetPushToken(id string) (string, bool) {
	pushTokensMux.RLock()
	defer pushTokensMux.RUnlock()
	token, ok := pushTokens[id]
	return token, ok
}

// History management
func SaveToHistory(id string, sm models.StoredMessage) {
	historyMux.Lock()
	defer historyMux.Unlock()

	f, err := os.OpenFile(filepath.Join(HistoryDir, id+".log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("history save error: %v\n", err)
		return
	}
	defer f.Close()
	json.NewEncoder(f).Encode(sm)
}

func GetHistory(id string) []models.StoredMessage {
	historyMux.Lock()
	defer historyMux.Unlock()

	content, err := os.ReadFile(filepath.Join(HistoryDir, id+".log"))
	if err != nil {
		return nil
	}

	var history []models.StoredMessage
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var sm models.StoredMessage
		if err := json.Unmarshal([]byte(line), &sm); err == nil {
			history = append(history, sm)
		}
	}
	return history
}
