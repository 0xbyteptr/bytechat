package groups

import (
	"encoding/json"
	"fmt"
	"time"

	"bytechat/models" // adjust import path
	"bytechat/storage"

	"github.com/gorilla/websocket"
)

type GroupMessage struct {
	Type      string          `json:"type"`
	GroupID   string          `json:"groupId"`
	GroupName string          `json:"groupName,omitempty"`
	Members   []string        `json:"members,omitempty"`
	Action    string          `json:"action,omitempty"`
	TargetID  string          `json:"targetId,omitempty"`
	From      string          `json:"from"`
	Timestamp int64           `json:"ts"`
	Data      json.RawMessage `json:"data,omitempty"`
}

// HandleGroupCreate creates a new group chat
func HandleGroupCreate(msg []byte, from string, conn *websocket.Conn, broadcast chan interface{}) error {
	var groupMsg GroupMessage
	if err := json.Unmarshal(msg, &groupMsg); err != nil {
		return fmt.Errorf("invalid group-create message: %w", err)
	}

	groupID := fmt.Sprintf("group_%s_%d", from, time.Now().UnixNano())
	group := models.Group{
		ID:        groupID,
		Name:      groupMsg.GroupName,
		Owner:     from,
		Members:   append(groupMsg.Members, from), // Owner is automatically added
		Admins:    []string{},
		CreatedAt: time.Now(),
		Settings: models.GroupSettings{
			Public:            false,
			AllowMemberInvite: true,
			RequireApproval:   false,
		},
	}

	// Save group to storage
	if err := storage.SaveGroup(groupID, group); err != nil {
		return fmt.Errorf("failed to save group: %w", err)
	}

	// Broadcast group created message to all members
	response := GroupMessage{
		Type:      "group-created",
		GroupID:   groupID,
		GroupName: group.Name,
		Members:   group.Members,
		From:      from,
		Timestamp: time.Now().UnixMilli(),
	}

	broadcast <- response
	return nil
}

// HandleGroupUpdate updates group settings
func HandleGroupUpdate(msg []byte, from string, conn *websocket.Conn, broadcast chan interface{}) error {
	var update struct {
		GroupID     string `json:"groupId"`
		Name        string `json:"name,omitempty"`
		Description string `json:"description,omitempty"`
	}

	if err := json.Unmarshal(msg, &update); err != nil {
		return fmt.Errorf("invalid group-update message: %w", err)
	}

	// Verify user is group admin
	group, err := storage.GetGroup(update.GroupID)
	if err != nil {
		return fmt.Errorf("group not found: %w", err)
	}

	if group.Owner != from && !contains(group.Admins, from) {
		return fmt.Errorf("unauthorized: only admins can update group")
	}

	// Update group
	if update.Name != "" {
		group.Name = update.Name
	}
	if update.Description != "" {
		group.Description = update.Description
	}

	if err := storage.SaveGroup(update.GroupID, *group); err != nil {
		return fmt.Errorf("failed to save group: %w", err)
	}

	// Broadcast update to group members
	response := GroupMessage{
		Type:      "group-updated",
		GroupID:   update.GroupID,
		GroupName: group.Name,
		From:      from,
		Timestamp: time.Now().UnixMilli(),
	}

	broadcast <- response
	return nil
}

// HandleAddGroupMember adds a member to a group
func HandleAddGroupMember(msg []byte, from string, conn *websocket.Conn, broadcast chan interface{}) error {
	var add struct {
		GroupID string `json:"groupId"`
		UserID  string `json:"userId"`
	}

	if err := json.Unmarshal(msg, &add); err != nil {
		return fmt.Errorf("invalid member-add message: %w", err)
	}

	group, err := storage.GetGroup(add.GroupID)
	if err != nil {
		return fmt.Errorf("group not found: %w", err)
	}

	// Check permissions
	if group.Owner != from && !contains(group.Admins, from) {
		// If member invites disabled, reject
		if !group.Settings.AllowMemberInvite {
			return fmt.Errorf("unauthorized: members cannot invite")
		}
	}

	// Check if already member
	if contains(group.Members, add.UserID) {
		return fmt.Errorf("user already in group")
	}

	// Add member
	group.Members = append(group.Members, add.UserID)
	if err := storage.SaveGroup(add.GroupID, *group); err != nil {
		return fmt.Errorf("failed to save group: %w", err)
	}

	response := GroupMessage{
		Type:      "member-added",
		GroupID:   add.GroupID,
		Action:    "member-added",
		TargetID:  add.UserID,
		From:      from,
		Members:   group.Members,
		Timestamp: time.Now().UnixMilli(),
	}

	broadcast <- response
	return nil
}

// HandleRemoveGroupMember removes a member from a group
func HandleRemoveGroupMember(msg []byte, from string, conn *websocket.Conn, broadcast chan interface{}) error {
	var remove struct {
		GroupID string `json:"groupId"`
		UserID  string `json:"userId"`
	}

	if err := json.Unmarshal(msg, &remove); err != nil {
		return fmt.Errorf("invalid member-remove message: %w", err)
	}

	group, err := storage.GetGroup(remove.GroupID)
	if err != nil {
		return fmt.Errorf("group not found: %w", err)
	}

	// Only owner and admins can remove
	if group.Owner != from && !contains(group.Admins, from) {
		return fmt.Errorf("unauthorized: only admins can remove members")
	}

	// Remove member
	group.Members = removeFrom(group.Members, remove.UserID)
	group.Admins = removeFrom(group.Admins, remove.UserID) // Also remove from admins if applicable

	if err := storage.SaveGroup(remove.GroupID, *group); err != nil {
		return fmt.Errorf("failed to save group: %w", err)
	}

	response := GroupMessage{
		Type:      "member-removed",
		GroupID:   remove.GroupID,
		Action:    "member-removed",
		TargetID:  remove.UserID,
		From:      from,
		Members:   group.Members,
		Timestamp: time.Now().UnixMilli(),
	}

	broadcast <- response
	return nil
}

// HandlePromoteAdmin promotes a member to admin
func HandlePromoteAdmin(msg []byte, from string, conn *websocket.Conn, broadcast chan interface{}) error {
	var promote struct {
		GroupID string `json:"groupId"`
		UserID  string `json:"userId"`
	}

	if err := json.Unmarshal(msg, &promote); err != nil {
		return fmt.Errorf("invalid promote message: %w", err)
	}

	group, err := storage.GetGroup(promote.GroupID)
	if err != nil {
		return fmt.Errorf("group not found: %w", err)
	}

	// Only owner can promote
	if group.Owner != from {
		return fmt.Errorf("unauthorized: only owner can promote admins")
	}

	// Check if member exists
	if !contains(group.Members, promote.UserID) {
		return fmt.Errorf("user not in group")
	}

	// Promote if not already admin
	if !contains(group.Admins, promote.UserID) {
		group.Admins = append(group.Admins, promote.UserID)
		if err := storage.SaveGroup(promote.GroupID, *group); err != nil {
			return fmt.Errorf("failed to save group: %w", err)
		}
	}

	response := GroupMessage{
		Type:      "member-promoted",
		GroupID:   promote.GroupID,
		Action:    "member-promoted",
		TargetID:  promote.UserID,
		From:      from,
		Timestamp: time.Now().UnixMilli(),
	}

	broadcast <- response
	return nil
}

// HandleDeleteGroup deletes a group (owner only)
func HandleDeleteGroup(msg []byte, from string, conn *websocket.Conn, broadcast chan interface{}) error {
	var delete struct {
		GroupID string `json:"groupId"`
	}

	if err := json.Unmarshal(msg, &delete); err != nil {
		return fmt.Errorf("invalid delete message: %w", err)
	}

	group, err := storage.GetGroup(delete.GroupID)
	if err != nil {
		return fmt.Errorf("group not found: %w", err)
	}

	// Only owner can delete
	if group.Owner != from {
		return fmt.Errorf("unauthorized: only owner can delete group")
	}

	// Delete group
	if err := storage.DeleteGroup(delete.GroupID); err != nil {
		return fmt.Errorf("failed to delete group: %w", err)
	}

	response := GroupMessage{
		Type:      "group-deleted",
		GroupID:   delete.GroupID,
		From:      from,
		Timestamp: time.Now().UnixMilli(),
	}

	broadcast <- response
	return nil
}

// Helper functions
func contains(slice []string, item string) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

func removeFrom(slice []string, item string) []string {
	var result []string
	for _, v := range slice {
		if v != item {
			result = append(result, v)
		}
	}
	return result
}
