package storage

import (
	"database/sql"
	"fmt"
	"os"
	"sync"

	_ "github.com/lib/pq"
)

const (
	CDNDir = "data/cdn"
)

var (
	db *sql.DB
	mu sync.RWMutex
)

// InitDB initializes PostgreSQL connection and creates tables
func InitDB() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Default PostgreSQL connection string
		dsn = "postgres://bytechat:bytechat@localhost:5432/bytechat?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Create tables
	if err := createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func createTables() error {
	schema := `
	-- Public keys table
	CREATE TABLE IF NOT EXISTS public_keys (
		id TEXT PRIMARY KEY,
		public_key TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Sessions table
	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		token TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Groups table
	CREATE TABLE IF NOT EXISTS groups (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		owner TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Group members table (for many-to-many relationship)
	CREATE TABLE IF NOT EXISTS group_members (
		group_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role TEXT DEFAULT 'member',
		joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (group_id, user_id),
		FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
	);

	-- Group admins table
	CREATE TABLE IF NOT EXISTS group_admins (
		group_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		PRIMARY KEY (group_id, user_id),
		FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
	);

	-- Group settings table
	CREATE TABLE IF NOT EXISTS group_settings (
		group_id TEXT PRIMARY KEY,
		is_public BOOLEAN DEFAULT FALSE,
		allow_member_invite BOOLEAN DEFAULT FALSE,
		require_approval BOOLEAN DEFAULT FALSE,
		FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
	);

	-- Message history table
	CREATE TABLE IF NOT EXISTS message_history (
		id BIGSERIAL PRIMARY KEY,
		from_id TEXT NOT NULL,
		to_id TEXT NOT NULL,
		message JSONB NOT NULL,
		timestamp BIGINT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		INDEX (to_id)
	);

	-- Push tokens table
	CREATE TABLE IF NOT EXISTS push_tokens (
		id TEXT PRIMARY KEY,
		token TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Create indexes for better performance
	CREATE INDEX IF NOT EXISTS idx_message_history_to_id ON message_history(to_id);
	CREATE INDEX IF NOT EXISTS idx_message_history_timestamp ON message_history(timestamp);
	CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
	`

	_, err := db.Exec(schema)
	return err
}

// CloseDB closes database connection
func CloseDB() error {
	if db != nil {
		return db.Close()
	}
	return nil
}

// GetDB returns database connection
func GetDB() *sql.DB {
	return db
}
