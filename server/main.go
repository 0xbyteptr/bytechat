package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/armor"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/nacl/box"
)

const dataDir = "data"
const historyDir = "data/history"

type challengeData struct {
	Code      string
	PublicKey string
}

type StoredMessage struct {
	From string                 `json:"from"`
	To   string                 `json:"to"`
	Msg  map[string]interface{} `json:"msg"`
	Ts   int64                  `json:"ts"`
}

var (
	keyStore      = make(map[string]string)        // id -> publicKey (armored PGP or Base64 Nacl)
	challenges    = make(map[string]challengeData) // id -> challenge data
	keysMutex     = sync.RWMutex{}
	challengesMux = sync.RWMutex{}
	historyMux    = sync.Mutex{}
	clients       = make(map[string]*client) // id -> client
	clientsMux    = sync.RWMutex{}
	pushTokens    = make(map[string]string) // id -> fcmToken
	pushTokensMux = sync.RWMutex{}
	upgrader      = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	// Max file size (default 50MB)
	maxFileSize int64 = 50 * 1024 * 1024

	// Server Nacl keypair for challenges
	serverPub  [32]byte
	serverPriv [32]byte
)

func init() {
	pub, priv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		log.Fatal(err)
	}
	serverPub = *pub
	serverPriv = *priv

	if envMax := os.Getenv("MAX_FILE_SIZE"); envMax != "" {
		if val, err := strconv.ParseInt(envMax, 10, 64); err == nil {
			maxFileSize = val
		}
	}

	// Ensure data directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(historyDir, 0755); err != nil {
		log.Fatal(err)
	}

	// Load existing keys
	loadKeys()
}

func loadKeys() {
	files, err := os.ReadDir(dataDir)
	if err != nil {
		log.Printf("Error reading data directory: %v\n", err)
		return
	}

	keysMutex.Lock()
	defer keysMutex.Unlock()

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".pub") {
			id := strings.TrimSuffix(file.Name(), ".pub")
			content, err := os.ReadFile(filepath.Join(dataDir, file.Name()))
			if err != nil {
				log.Printf("Error reading key file %s: %v\n", file.Name(), err)
				continue
			}
			keyStore[id] = string(content)
		}
	}
	log.Printf("Loaded %d keys from %s\n", len(keyStore), dataDir)
}

func saveKey(id, publicKey string) error {
	return os.WriteFile(filepath.Join(dataDir, id+".pub"), []byte(publicKey), 0644)
}

type client struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *client) send(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/challenge", challengeHandler)
	mux.HandleFunc("/keys", keysHandler) // POST to register, GET to fetch
	mux.HandleFunc("/ws", wsHandler)

	addr := ":8080"
	fmt.Printf("ByteChat server starting on %s (Max File Size: %d MB)\n", addr, maxFileSize/1024/1024)
	log.Fatal(http.ListenAndServe(addr, corsMiddleware(mux)))
}

func isPGP(key string) bool {
	return strings.Contains(key, "-----BEGIN PGP")
}

func challengeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST required", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		ID        string `json:"id"`
		PublicKey string `json:"publicKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	// If user exists, we MUST use their registered key for the challenge
	keysMutex.RLock()
	storedPub, exists := keyStore[body.ID]
	keysMutex.RUnlock()

	pubToUse := body.PublicKey
	if exists {
		pubToUse = storedPub
	}

	b := make([]byte, 16)
	rand.Read(b)
	code := fmt.Sprintf("byte-0x%x", b)

	var encrypted string
	var err error
	var serverNaclPub string

	if isPGP(pubToUse) {
		encrypted, err = encryptPGP(pubToUse, code)
	} else {
		var nonce string
		encrypted, nonce, err = encryptNacl(pubToUse, code)
		encrypted = encrypted + "|" + nonce // Simple way to send both
		serverNaclPub = base64.StdEncoding.EncodeToString(serverPub[:])
	}

	if err != nil {
		http.Error(w, "failed to encrypt challenge: "+err.Error(), http.StatusInternalServerError)
		return
	}

	challengesMux.Lock()
	challenges[body.ID] = challengeData{Code: code, PublicKey: pubToUse}
	challengesMux.Unlock()

	json.NewEncoder(w).Encode(map[string]string{
		"encryptedChallenge": encrypted,
		"serverPublicKey":    serverNaclPub,
	})
}

func encryptNacl(publicKeyBase64, text string) (string, string, error) {
	publicKeyBase64 = strings.TrimSpace(publicKeyBase64)
	pubBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil {
		return "", "", err
	}
	if len(pubBytes) != 32 {
		return "", "", fmt.Errorf("invalid nacl public key length")
	}
	var recipientPub [32]byte
	copy(recipientPub[:], pubBytes)

	var nonce [24]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return "", "", err
	}

	out := box.Seal(nil, []byte(text), &nonce, &recipientPub, &serverPriv)
	return base64.StdEncoding.EncodeToString(out), base64.StdEncoding.EncodeToString(nonce[:]), nil
}

func encryptPGP(publicKeyArmored, text string) (string, error) {
	entityList, err := openpgp.ReadArmoredKeyRing(strings.NewReader(publicKeyArmored))
	if err != nil {
		return "", err
	}

	encBuf := new(bytes.Buffer)
	w, err := armor.Encode(encBuf, "PGP MESSAGE", nil)
	if err != nil {
		return "", err
	}

	plainWriter, err := openpgp.Encrypt(w, entityList, nil, nil, nil)
	if err != nil {
		return "", err
	}

	if _, err := plainWriter.Write([]byte(text)); err != nil {
		return "", err
	}

	plainWriter.Close()
	w.Close()

	return encBuf.String(), nil
}

func verifyPGPSignature(publicKeyArmored, signatureArmored, message string) error {
	entityList, err := openpgp.ReadArmoredKeyRing(strings.NewReader(publicKeyArmored))
	if err != nil {
		return fmt.Errorf("failed to read public key: %v", err)
	}

	_, err = openpgp.CheckDetachedSignature(entityList, strings.NewReader(message), strings.NewReader(signatureArmored), nil)
	if err != nil {
		return fmt.Errorf("signature verification failed: %v", err)
	}
	return nil
}

// keysHandler: POST {id, publicKey, code}  GET ?id=...
func keysHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		var body struct {
			ID        string `json:"id"`
			PublicKey string `json:"publicKey"`
			Code      string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		// Case 1: Registration (providing publicKey, no code)
		if body.PublicKey != "" && body.Code == "" {
			keysMutex.Lock()
			defer keysMutex.Unlock()
			if _, exists := keyStore[body.ID]; exists {
				http.Error(w, "id already taken", http.StatusConflict)
				return
			}
			if err := saveKey(body.ID, body.PublicKey); err != nil {
				http.Error(w, "failed to save key", http.StatusInternalServerError)
				return
			}
			keyStore[body.ID] = body.PublicKey
			w.WriteHeader(http.StatusCreated)
			return
		}

		// Case 2: Verification (providing code)
		challengesMux.RLock()
		cData, ok := challenges[body.ID]
		challengesMux.RUnlock()

		if !ok {
			http.Error(w, "no challenge found for this id", http.StatusBadRequest)
			return
		}

		if body.Code != cData.Code {
			http.Error(w, "invalid code", http.StatusUnauthorized)
			return
		}

		keysMutex.Lock()
		if err := saveKey(body.ID, cData.PublicKey); err != nil {
			keysMutex.Unlock()
			http.Error(w, "failed to save key", http.StatusInternalServerError)
			return
		}
		keyStore[body.ID] = cData.PublicKey
		keysMutex.Unlock()

		challengesMux.Lock()
		delete(challenges, body.ID)
		challengesMux.Unlock()

		w.WriteHeader(http.StatusCreated)
		return
	case http.MethodGet:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id query param required", http.StatusBadRequest)
			return
		}
		keysMutex.RLock()
		pk, ok := keyStore[id]
		keysMutex.RUnlock()
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"id": id, "publicKey": pk})
		return
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
}

// wsHandler upgrades connection and registers the client using ?id=<id>
func wsHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "id query param required", http.StatusBadRequest)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	// Set read limit for large file transfers (base64 overhead + JSON)
	conn.SetReadLimit(maxFileSize * 2)

	c := &client{conn: conn}
	clientsMux.Lock()
	clients[id] = c
	clientsMux.Unlock()
	log.Printf("%s connected\n", id)

	// Send history to client
	go func() {
		history := getHistory(id)
		for _, sm := range history {
			// For history, we need to tell the client who the "other" person is
			// so it can put the message in the right chat window.
			other := sm.From
			if sm.From == id {
				other = sm.To
			}
			sm.Msg["from"] = sm.From
			sm.Msg["chatWith"] = other
			sm.Msg["isHistory"] = true
			c.send(sm.Msg)
		}
	}()

	defer func() {
		clientsMux.Lock()
		delete(clients, id)
		clientsMux.Unlock()
		conn.Close()
		log.Printf("%s disconnected\n", id)
	}()

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			log.Println("read error:", err)
			return
		}

		to, _ := msg["to"].(string)
		if to == "" {
			continue
		}

		// Add timestamp if missing
		if _, ok := msg["ts"]; !ok {
			msg["ts"] = time.Now().UnixMilli()
		}

		// Save to history for both sender and recipient
		sm := StoredMessage{
			From: id,
			To:   to,
			Msg:  msg,
			Ts:   jsonTime(msg["ts"]),
		}
		saveToHistory(id, sm)
		saveToHistory(to, sm)

		// relay to recipient if connected
		clientsMux.RLock()
		toClient, ok := clients[to]
		clientsMux.RUnlock()
		if ok {
			msg["from"] = id
			delete(msg, "to")
			if err := toClient.send(msg); err != nil {
				log.Println("relay write error:", err)
			}
		} else {
			// recipient offline — silent drop (no plaintext stored)
			log.Printf("recipient %s offline; dropping message\n", to)
		}
	}
}

func jsonTime(v interface{}) int64 {
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int64:
		return t
	}
	return 0
}

func saveToHistory(id string, sm StoredMessage) {
	historyMux.Lock()
	defer historyMux.Unlock()

	f, err := os.OpenFile(filepath.Join(historyDir, id+".log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("history save error: %v\n", err)
		return
	}
	defer f.Close()
	json.NewEncoder(f).Encode(sm)
}

func getHistory(id string) []StoredMessage {
	historyMux.Lock()
	defer historyMux.Unlock()

	content, err := os.ReadFile(filepath.Join(historyDir, id+".log"))
	if err != nil {
		return nil
	}

	var history []StoredMessage
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		var sm StoredMessage
		if err := json.Unmarshal([]byte(line), &sm); err == nil {
			history = append(history, sm)
		}
	}
	return history
}
