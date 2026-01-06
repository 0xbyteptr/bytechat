package websocket

import (
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"bytechat/auth"
	"bytechat/models"
	"bytechat/push"
	"bytechat/storage"

	"github.com/gorilla/websocket"
)

var (
	clients    = make(map[string]*Client) // id -> client
	clientsMux = sync.RWMutex{}
	upgrader   = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	maxFileSize int64 = 50 * 1024 * 1024
)

// Client represents a WebSocket client
type Client struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

// Send sends a message to the client
func (c *Client) Send(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteJSON(v)
}

// SetMaxFileSize sets the maximum file size for WebSocket messages
func SetMaxFileSize(size int64) {
	maxFileSize = size
}

// Handler handles WebSocket connections
func Handler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error from %s: %v\n", r.RemoteAddr, err)
		return
	}

	conn.SetReadLimit(maxFileSize * 2)
	conn.SetReadDeadline(time.Now().Add(10 * time.Second)) // 10 second timeout for auth

	// Wait for authentication message
	var authMsg map[string]interface{}
	if err := conn.ReadJSON(&authMsg); err != nil {
		log.Printf("Auth read error from %s: %v\n", r.RemoteAddr, err)
		conn.Close()
		return
	}

	authType, _ := authMsg["type"].(string)
	if authType != "auth" {
		log.Printf("First message not auth from %s\n", r.RemoteAddr)
		conn.WriteJSON(map[string]interface{}{
			"type":  "error",
			"error": "authentication required",
		})
		conn.Close()
		return
	}

	id, _ := authMsg["id"].(string)
	token, _ := authMsg["token"].(string)

	if id == "" || !auth.IsValidToken(id, token) {
		log.Printf("Unauthorized WS attempt from %s (id: %s)\n", r.RemoteAddr, id)
		conn.WriteJSON(map[string]interface{}{
			"type":  "error",
			"error": "invalid credentials",
		})
		conn.Close()
		return
	}

	// Clear read deadline after successful auth
	conn.SetReadDeadline(time.Time{})

	c := &Client{conn: conn}
	clientsMux.Lock()
	clients[id] = c
	clientsMux.Unlock()
	log.Printf("%s connected via WS from %s\n", id, r.RemoteAddr)

	// Send authentication success
	c.Send(map[string]interface{}{
		"type":   "auth",
		"status": "success",
	})

	go func() {
		history := storage.GetHistory(id)
		for _, sm := range history {
			other := sm.From
			if sm.From == id {
				other = sm.To
			}
			sm.Msg["from"] = sm.From
			sm.Msg["chatWith"] = other
			sm.Msg["isHistory"] = true
			c.Send(sm.Msg)
		}

		memberGroups := storage.GetAllGroupIDs(id)
		for _, gid := range memberGroups {
			gh := storage.GetHistory(gid)
			for _, sm := range gh {
				sm.Msg["from"] = sm.From
				sm.Msg["chatWith"] = gid
				sm.Msg["isHistory"] = true
				c.Send(sm.Msg)
			}
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

		// Skip auth messages after initial authentication
		if msgType, ok := msg["type"].(string); ok && msgType == "auth" {
			continue
		}

		to, _ := msg["to"].(string)
		if to == "" {
			continue
		}

		if _, ok := msg["ts"]; !ok {
			msg["ts"] = time.Now().UnixMilli()
		}

		sm := models.StoredMessage{
			From: id,
			To:   to,
			Msg:  msg,
			Ts:   jsonTime(msg["ts"]),
		}

		if strings.HasPrefix(to, "#") {
			g, ok := storage.GetGroup(to)
			if ok {
				storage.SaveToHistory(to, sm)
				clientsMux.RLock()
				for _, m := range g.Members {
					if m == id {
						continue
					}
					if tc, ok := clients[m]; ok {
						msgCopy := make(map[string]interface{})
						for k, v := range msg {
							msgCopy[k] = v
						}
						msgCopy["from"] = id
						msgCopy["chatWith"] = to
						tc.Send(msgCopy)
					} else {
						push.SendPush(m, id, to)
					}
				}
				clientsMux.RUnlock()
			}
			continue
		}

		storage.SaveToHistory(id, sm)
		storage.SaveToHistory(to, sm)

		clientsMux.RLock()
		toClient, ok := clients[to]
		clientsMux.RUnlock()
		if ok {
			msg["from"] = id
			delete(msg, "to")
			if err := toClient.Send(msg); err != nil {
				log.Println("relay write error:", err)
			}
		} else {
			log.Printf("recipient %s (from %s) offline; sending push notification\n", to, id)
			push.SendPush(to, id, id)
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
