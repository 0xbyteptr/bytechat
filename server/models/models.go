package models

import "time"

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

// GroupSettings represents group configuration
type GroupSettings struct {
	Public            bool `json:"public"`
	AllowMemberInvite bool `json:"allowMemberInvite"`
	RequireApproval   bool `json:"requireApproval"`
}

// Group represents a chat group with full administration support
type Group struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description,omitempty"`
	Members     []string      `json:"members"`
	Owner       string        `json:"owner"`
	Admins      []string      `json:"admins"`
	CreatedAt   time.Time     `json:"createdAt"`
	Settings    GroupSettings `json:"settings"`
}
