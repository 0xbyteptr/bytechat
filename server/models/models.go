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

// Profile represents a user's public profile metadata
type Profile struct {
	ID            string    `json:"id"`
	DisplayName   string    `json:"displayName,omitempty"`
	Bio           string    `json:"bio,omitempty"`
	AvatarURL     string    `json:"avatarUrl,omitempty"`
	BannerURL     string    `json:"bannerUrl,omitempty"`
	Status        string    `json:"status,omitempty"` // online, away, busy, offline
	CustomMessage string    `json:"customMessage,omitempty"`
	LastSeen      int64     `json:"lastSeen,omitempty"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// Friend represents a confirmed friendship relationship
type Friend struct {
	ID        int64     `json:"id"`
	UserID1   string    `json:"userId1"`
	UserID2   string    `json:"userId2"`
	CreatedAt time.Time `json:"createdAt"`
}

// FriendRequest represents a pending friend request
type FriendRequest struct {
	ID        int64     `json:"id"`
	FromID    string    `json:"fromId"`
	ToID      string    `json:"toId"`
	Status    string    `json:"status"` // pending, accepted, rejected, blocked
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// FriendResponse represents friend data with profile information
type FriendResponse struct {
	User      Profile   `json:"user"`
	IsFriend  bool      `json:"isFriend"`
	CreatedAt time.Time `json:"createdAt,omitempty"`
}
