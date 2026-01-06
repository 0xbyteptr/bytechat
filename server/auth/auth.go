package auth

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"bytechat/models"
	"bytechat/storage"

	"golang.org/x/crypto/nacl/box"
)

var (
	challenges    = make(map[string]models.ChallengeData) // id -> challenge data
	challengesMux = sync.RWMutex{}

	// Server Nacl keypair for challenges
	serverPub  [32]byte
	serverPriv [32]byte
)

// Init initializes the auth module
func Init() error {
	pub, priv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}
	serverPub = *pub
	serverPriv = *priv
	return nil
}

// IsValidToken validates a session token
func IsValidToken(id, token string) bool {
	if id == "" || token == "" {
		return false
	}
	stored, ok := storage.GetSession(id)
	if !ok {
		log.Printf("Session not found for id: %s\n", id)
		return false
	}
	if stored != token {
		log.Printf("Token mismatch for id %s: expected %s, got %s\n", id, stored, token)
		return false
	}
	return true
}

// EncryptNacl encrypts text using NaCl box
func EncryptNacl(publicKeyBase64, text string) (string, string, error) {
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

// ChallengeHandler handles authentication challenges
func ChallengeHandler(w http.ResponseWriter, r *http.Request) {
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

	b := make([]byte, 16)
	rand.Read(b)
	code := fmt.Sprintf("byte-0x%x", b)

	encrypted, nonce, err := EncryptNacl(body.PublicKey, code)
	if err != nil {
		http.Error(w, "failed to encrypt challenge: "+err.Error(), http.StatusInternalServerError)
		return
	}
	encrypted = encrypted + "|" + nonce

	challengesMux.Lock()
	challenges[body.ID] = models.ChallengeData{Code: code, PublicKey: body.PublicKey}
	challengesMux.Unlock()

	json.NewEncoder(w).Encode(map[string]string{
		"encryptedChallenge": encrypted,
		"serverPublicKey":    base64.StdEncoding.EncodeToString(serverPub[:]),
	})
}

// KeysHandler handles key registration and retrieval
func KeysHandler(w http.ResponseWriter, r *http.Request) {
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
			if storage.KeyExists(body.ID) {
				http.Error(w, "id already taken", http.StatusConflict)
				return
			}
			if err := storage.SaveKey(body.ID, body.PublicKey); err != nil {
				http.Error(w, "failed to save key", http.StatusInternalServerError)
				return
			}

			// Generate session token
			tBytes := make([]byte, 32)
			rand.Read(tBytes)
			token := base64.StdEncoding.EncodeToString(tBytes)

			storage.SaveSession(body.ID, token)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"status": "success",
				"token":  token,
			})
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

		if err := storage.SaveKey(body.ID, cData.PublicKey); err != nil {
			http.Error(w, "failed to save key", http.StatusInternalServerError)
			return
		}

		challengesMux.Lock()
		delete(challenges, body.ID)
		challengesMux.Unlock()

		// Generate session token
		tBytes := make([]byte, 32)
		rand.Read(tBytes)
		token := base64.StdEncoding.EncodeToString(tBytes)

		storage.SaveSession(body.ID, token)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
			"token":  token,
		})
		return
	case http.MethodGet:
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "id query param required", http.StatusBadRequest)
			return
		}

		pk, ok := storage.GetKey(id)
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

// ValidateSessionHandler validates a session token
func ValidateSessionHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	token := r.URL.Query().Get("token")
	if id == "" || !IsValidToken(id, token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// PushTokenHandler handles FCM token registration
func PushTokenHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		ID           string `json:"id"`
		Token        string `json:"token"`
		SessionToken string `json:"sessionToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !IsValidToken(body.ID, body.SessionToken) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	storage.SavePushToken(body.ID, body.Token)
	w.WriteHeader(http.StatusOK)
}
