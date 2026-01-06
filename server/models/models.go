package models

// ChallengeData represents authentication challenge information
type ChallengeData struct {
	Code      string
	PublicKey string
}

// StoredMessage represents a persisted chat message
type StoredMessage struct {
	From string                 `json:"from"`
	To   string                 `json:"to"`
	Msg  map[string]interface{} `json:"msg"`
	Ts   int64                  `json:"ts"`
}

// Group represents a chat group
type Group struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Members []string `json:"members"`
	Admin   string   `json:"admin"`
}
