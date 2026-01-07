package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"bytechat/auth"
	"bytechat/groups"
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

func init() {
	// Periodically broadcast presence every 10 seconds to keep the list fresh
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			BroadcastPresence()
		}
	}()
}

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

// GetOnlineUsers returns list of currently connected user IDs
func GetOnlineUsers() []string {
	clientsMux.RLock()
	defer clientsMux.RUnlock()
	onlineUsers := make([]string, 0, len(clients))
	for userID := range clients {
		onlineUsers = append(onlineUsers, userID)
	}
	return onlineUsers
}

// BroadcastPresence sends online user list to all connected clients
func BroadcastPresence() {
	onlineUsers := GetOnlineUsers()
	msg := map[string]interface{}{
		"type":   "presence",
		"online": onlineUsers,
	}
	clientsMux.RLock()
	defer clientsMux.RUnlock()
	for _, client := range clients {
		client.Send(msg)
	}
}

func conversationID(a, b string) string {
	// Groups use the group id as the stable conversation id
	if strings.HasPrefix(a, "#") {
		return a
	}
	if strings.HasPrefix(b, "#") {
		return b
	}
	if a < b {
		return a + "|" + b
	}
	return b + "|" + a
}

func messageIDFromMap(m map[string]interface{}) string {
	if v, ok := m["messageId"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
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

	// Configure ping/pong handlers for keepalive
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(90 * time.Second))
		return nil
	})

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

	// Broadcast updated presence to all users
	go BroadcastPresence()

	// Send ping messages every 30 seconds to keep connection alive
	pingTicker := time.NewTicker(30 * time.Second)
	defer pingTicker.Stop()
	go func() {
		for range pingTicker.C {
			c.mu.Lock()
			if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				c.mu.Unlock()
				return
			}
			c.mu.Unlock()
		}
	}()

	go func() {
		history := storage.GetHistory(id)
		directReactions := buildDirectReactionLookup(id, history)
		for _, sm := range history {
			other := sm.From
			if sm.From == id {
				other = sm.To
			}
			msgID := messageIDFromMap(sm.Msg)
			convID := conversationID(id, other)
			if msgID != "" {
				if r := directReactions[convID][msgID]; len(r) > 0 {
					sm.Msg["reactions"] = r
				}
			}
			sm.Msg["from"] = sm.From
			sm.Msg["chatWith"] = other
			sm.Msg["isHistory"] = true
			c.Send(sm.Msg)
		}

		memberGroups := storage.GetAllGroupIDs(id)
		for _, gid := range memberGroups {
			gh := storage.GetHistory(gid)
			groupReactions := buildGroupReactionLookup(gid, gh)
			for _, sm := range gh {
				msgID := messageIDFromMap(sm.Msg)
				if msgID != "" {
					if r := groupReactions[msgID]; len(r) > 0 {
						sm.Msg["reactions"] = r
					}
				}
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
		// Broadcast updated presence to remaining users
		go BroadcastPresence()
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

		// Handle edit message
		if msgType, ok := msg["type"].(string); ok && msgType == "edit" {
			to, _ := msg["to"].(string)
			if to == "" {
				continue
			}

			msg["from"] = id
			msg["editedAt"] = time.Now().UnixMilli()
			delete(msg, "to")

			// Forward to recipient
			if strings.HasPrefix(to, "#") {
				// Group message edit
				g, err := storage.GetGroup(to)
				if err == nil {
					msg["chatWith"] = to
					clientsMux.RLock()
					for _, m := range g.Members {
						if m == id {
							continue
						}
						if tc, ok := clients[m]; ok {
							tc.Send(msg)
						}
					}
					clientsMux.RUnlock()
				}
			} else {
				// Direct message edit
				clientsMux.RLock()
				toClient, ok := clients[to]
				clientsMux.RUnlock()
				if ok {
					toClient.Send(msg)
				}
			}
			continue
		}

		// Handle delete message
		if msgType, ok := msg["type"].(string); ok && msgType == "delete" {
			to, _ := msg["to"].(string)
			if to == "" {
				continue
			}

			msg["from"] = id
			delete(msg, "to")

			// Forward to recipient
			if strings.HasPrefix(to, "#") {
				// Group message delete
				g, err := storage.GetGroup(to)
				if err == nil {
					msg["chatWith"] = to
					clientsMux.RLock()
					for _, m := range g.Members {
						if m == id {
							continue
						}
						if tc, ok := clients[m]; ok {
							tc.Send(msg)
						}
					}
					clientsMux.RUnlock()
				}
			} else {
				// Direct message delete
				clientsMux.RLock()
				toClient, ok := clients[to]
				clientsMux.RUnlock()
				if ok {
					toClient.Send(msg)
				}
			}
			continue
		}

		// Handle read receipt
		if msgType, ok := msg["type"].(string); ok && msgType == "read" {
			from, _ := msg["from"].(string)
			if from == "" {
				continue
			}

			msg["from"] = id
			msg["readAt"] = time.Now().UnixMilli()

			// Forward to sender
			clientsMux.RLock()
			senderClient, ok := clients[from]
			clientsMux.RUnlock()
			if ok {
				senderClient.Send(msg)
			}
			continue
		}

		// Handle reactions
		if msgType, ok := msg["type"].(string); ok && msgType == "react" {
			to, _ := msg["to"].(string)
			messageID, _ := msg["messageId"].(string)
			emoji, _ := msg["emoji"].(string)

			if to == "" || messageID == "" || emoji == "" {
				continue
			}

			convID := conversationID(id, to)
			if _, err := storage.ToggleReaction(convID, messageID, emoji, id); err != nil {
				log.Printf("reaction toggle error: %v\n", err)
			}

			out := map[string]interface{}{
				"type":      "react",
				"from":      id,
				"messageId": messageID,
				"emoji":     emoji,
				"chatWith":  to,
			}

			if strings.HasPrefix(to, "#") {
				g, err := storage.GetGroup(to)
				if err == nil {
					clientsMux.RLock()
					for _, m := range g.Members {
						if m == id {
							continue
						}
						if tc, ok := clients[m]; ok {
							tc.Send(out)
						}
					}
					clientsMux.RUnlock()
				}
			} else {
				clientsMux.RLock()
				toClient, ok := clients[to]
				clientsMux.RUnlock()
				if ok {
					toClient.Send(out)
				}
			}
			continue
		}

		// Handle group management messages
		if msgType, ok := msg["type"].(string); ok {
			switch msgType {
			case "group-create":
				if err := groups.HandleGroupCreate(jsonMarshal(msg), id, conn, nil); err != nil {
					log.Printf("group-create error: %v\n", err)
				}
				continue
			case "group-update":
				if err := groups.HandleGroupUpdate(jsonMarshal(msg), id, conn, nil); err != nil {
					log.Printf("group-update error: %v\n", err)
				}
				continue
			case "member-add":
				if err := groups.HandleAddGroupMember(jsonMarshal(msg), id, conn, nil); err != nil {
					log.Printf("member-add error: %v\n", err)
				}
				continue
			case "member-remove":
				if err := groups.HandleRemoveGroupMember(jsonMarshal(msg), id, conn, nil); err != nil {
					log.Printf("member-remove error: %v\n", err)
				}
				continue
			case "member-promote":
				if err := groups.HandlePromoteAdmin(jsonMarshal(msg), id, conn, nil); err != nil {
					log.Printf("member-promote error: %v\n", err)
				}
				continue
			case "group-delete":
				if err := groups.HandleDeleteGroup(jsonMarshal(msg), id, conn, nil); err != nil {
					log.Printf("group-delete error: %v\n", err)
				}
				continue
			}
		}

		// Handle VoIP signaling messages (call-offer, call-answer, call-ice-candidate, call-end)
		if msgType, ok := msg["type"].(string); ok && strings.HasPrefix(msgType, "call-") {
			to, _ := msg["to"].(string)
			if to == "" {
				continue
			}

			msg["from"] = id
			delete(msg, "to")

			// Forward VoIP signaling to recipient
			clientsMux.RLock()
			toClient, ok := clients[to]
			clientsMux.RUnlock()
			if ok {
				toClient.Send(msg)
			}
			continue
		}

		// Handle voice messages
		if msgType, ok := msg["type"].(string); ok && msgType == "voice" {
			to, _ := msg["to"].(string)
			if to == "" {
				continue
			}

			msg["from"] = id
			if _, ok := msg["ts"]; !ok {
				msg["ts"] = time.Now().UnixMilli()
			}
			delete(msg, "to")

			sm := models.StoredMessage{
				From: id,
				To:   to,
				Msg:  msg,
				Ts:   jsonTime(msg["ts"]),
			}

			if strings.HasPrefix(to, "#") {
				// Group voice message
				g, err := storage.GetGroup(to)
				if err == nil {
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
						}
					}
					clientsMux.RUnlock()
				}
			} else {
				// Direct voice message
				storage.SaveToHistory(id, sm)
				storage.SaveToHistory(to, sm)

				clientsMux.RLock()
				toClient, ok := clients[to]
				clientsMux.RUnlock()
				if ok {
					if err := toClient.Send(msg); err != nil {
						log.Println("relay voice error:", err)
					}
				} else {
					log.Printf("recipient %s (from %s) offline; sending push notification\n", to, id)
					push.SendPush(to, id, id)
				}
			}
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
			g, err := storage.GetGroup(to)
			if err == nil {
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

func jsonMarshal(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}

func buildDirectReactionLookup(selfID string, history []models.StoredMessage) map[string]map[string]map[string][]string {
	convToMsgIDs := make(map[string][]string)
	for _, sm := range history {
		msgID := messageIDFromMap(sm.Msg)
		if msgID == "" {
			continue
		}
		other := sm.From
		if sm.From == selfID {
			other = sm.To
		}
		convID := conversationID(selfID, other)
		convToMsgIDs[convID] = append(convToMsgIDs[convID], msgID)
	}

	lookup := make(map[string]map[string]map[string][]string)
	for convID, ids := range convToMsgIDs {
		lookup[convID] = storage.GetReactions(convID, ids)
	}
	return lookup
}

func buildGroupReactionLookup(conversationID string, history []models.StoredMessage) map[string]map[string][]string {
	ids := make([]string, 0, len(history))
	for _, sm := range history {
		msgID := messageIDFromMap(sm.Msg)
		if msgID != "" {
			ids = append(ids, msgID)
		}
	}
	return storage.GetReactions(conversationID, ids)
}
