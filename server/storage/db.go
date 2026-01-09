package storage

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

const (
	CDNDir = "data/cdn"
)

var (
	db *sql.DB
	mu sync.RWMutex
)

// InitDB initializes PostgreSQL connection and creates tables, creating the database if needed
func InitDB() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Default PostgreSQL connection string
		dsn = "postgres://bytechat:bytechat@localhost:5432/bytechat?sslmode=disable"
	}

	// Try to ensure database exists (best effort, fail gracefully if no permission)
	if err := ensureDatabase(dsn); err != nil {
		fmt.Printf("Warning: Could not ensure database exists (this may be normal if database already exists): %v\n", err)
	}

	// Extract username from DSN for permission handling
	userAndPass := strings.Split(strings.TrimPrefix(dsn, "postgres://"), "@")[0]
	username := strings.Split(userAndPass, ":")[0]

	// Grant schema permissions using postgres superuser
	if err := grantSchemaPermissions(dsn, username); err != nil {
		fmt.Printf("Warning: Could not grant schema permissions (may need manual setup): %v\n", err)
	}

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)                 // Max concurrent connections
	db.SetMaxIdleConns(5)                  // Idle connections to keep alive
	db.SetConnMaxLifetime(5 * time.Minute) // Reuse connections for max 5 minutes
	db.SetConnMaxIdleTime(2 * time.Minute) // Close idle connections after 2 minutes

	// Test the connection
	if err := db.Ping(); err != nil {
		// Provide helpful error message if database doesn't exist
		if strings.Contains(err.Error(), "does not exist") {
			return fmt.Errorf(`failed to connect to database: database does not exist
			
To set up the database, run one of the following:

1. Using Docker Compose (recommended):
   docker-compose up -d
   
2. Using PostgreSQL directly:
   psql -U postgres -f server/init-db.sql
   
3. Manually:
   createdb -U postgres bytechat

Then try running the server again: %w`, err)
		}
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Create tables
	if err := createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

// ensureDatabase creates the database if it doesn't exist
func ensureDatabase(dsn string) error {
	// Parse connection string to extract database name
	parts := strings.Split(dsn, "/")
	if len(parts) < 2 {
		return fmt.Errorf("invalid database URL format")
	}

	// Get the part after the last /
	lastPart := parts[len(parts)-1]

	// Extract database name and query params
	dbAndParams := strings.Split(lastPart, "?")
	dbName := dbAndParams[0]
	if dbName == "" {
		return fmt.Errorf("could not extract database name from URL")
	}

	// Build admin DSN by replacing database name with 'postgres'
	baseDSN := strings.Join(parts[:len(parts)-1], "/") + "/postgres"
	if len(dbAndParams) > 1 {
		baseDSN += "?" + dbAndParams[1]
	}

	adminDB, err := sql.Open("postgres", baseDSN)
	if err != nil {
		return fmt.Errorf("failed to open admin database connection: %w", err)
	}
	defer adminDB.Close()

	// Test connection
	if err := adminDB.Ping(); err != nil {
		return fmt.Errorf("failed to connect to postgres database: %w", err)
	}

	// Check if database exists
	var exists bool
	checkSQL := `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1);`
	err = adminDB.QueryRow(checkSQL, dbName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if database exists: %w", err)
	}

	if !exists {
		// Database doesn't exist, create it
		createSQL := fmt.Sprintf(`CREATE DATABASE %s;`, dbName)
		_, err = adminDB.Exec(createSQL)
		if err != nil {
			return fmt.Errorf("failed to create database: %w", err)
		}
		fmt.Printf("Created database: %s\n", dbName)
	}

	return nil
}

// grantSchemaPermissions grants necessary permissions to a user for schema operations
func grantSchemaPermissions(dsn string, username string) error {
	if username == "" || username == "postgres" {
		return nil // Skip for postgres user or if username couldn't be extracted
	}

	// Parse DSN to get host, port, database info
	parts := strings.Split(dsn, "/")
	if len(parts) < 2 {
		return fmt.Errorf("invalid database URL format")
	}

	lastPart := parts[len(parts)-1]
	dbAndParams := strings.Split(lastPart, "?")
	dbName := dbAndParams[0]

	// Build admin DSN by replacing database name with 'postgres' but keeping it as postgres user
	baseDSN := strings.Join(parts[:len(parts)-1], "/") + "/postgres"
	if len(dbAndParams) > 1 {
		baseDSN += "?" + dbAndParams[1]
	}

	// Connect as postgres superuser to grant permissions
	adminDB, err := sql.Open("postgres", baseDSN)
	if err != nil {
		return err
	}
	defer adminDB.Close()

	// Test connection first
	if err := adminDB.Ping(); err != nil {
		return err
	}

	// Grant permissions on the target database
	_, err = adminDB.Exec(fmt.Sprintf(`GRANT ALL PRIVILEGES ON DATABASE %s TO %s;`, dbName, username))
	if err != nil && !strings.Contains(err.Error(), "already granted") {
		return err
	}

	// Now connect to the target database to grant schema permissions
	targetDB, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	defer targetDB.Close()

	// Grant permissions on the public schema
	_, err = targetDB.Exec(fmt.Sprintf(`GRANT ALL PRIVILEGES ON SCHEMA public TO %s;`, username))
	if err != nil && !strings.Contains(err.Error(), "already granted") {
		// This might fail if connected as regular user, try with admin connection instead
		_, err2 := adminDB.Exec(fmt.Sprintf(`GRANT ALL PRIVILEGES ON SCHEMA public TO %s;`, username))
		if err2 != nil {
			return err
		}
	}

	// Grant default privileges for future objects
	_, err = adminDB.Exec(fmt.Sprintf(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %s;`, username))
	if err != nil && !strings.Contains(err.Error(), "already granted") {
		return err
	}

	_, err = adminDB.Exec(fmt.Sprintf(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %s;`, username))
	if err != nil && !strings.Contains(err.Error(), "already granted") {
		return err
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
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Message reactions table
	CREATE TABLE IF NOT EXISTS message_reactions (
		id BIGSERIAL PRIMARY KEY,
		conversation_id TEXT NOT NULL,
		message_id TEXT NOT NULL,
		emoji TEXT NOT NULL,
		user_id TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (conversation_id, message_id, emoji, user_id)
	);

	-- User profiles table
	CREATE TABLE IF NOT EXISTS user_profiles (
		id TEXT PRIMARY KEY,
		display_name TEXT,
		bio TEXT,
		avatar_url TEXT,
		banner_url TEXT,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Push tokens table
	CREATE TABLE IF NOT EXISTS push_tokens (
		id TEXT PRIMARY KEY,
		token TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	-- Friends table (for confirmed friendships)
	CREATE TABLE IF NOT EXISTS friends (
		id BIGSERIAL PRIMARY KEY,
		user_id_1 TEXT NOT NULL,
		user_id_2 TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id_1, user_id_2),
		CHECK (user_id_1 < user_id_2)
	);

	-- Friend requests table (pending friend requests)
	CREATE TABLE IF NOT EXISTS friend_requests (
		id BIGSERIAL PRIMARY KEY,
		from_id TEXT NOT NULL,
		to_id TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(from_id, to_id),
		CHECK (from_id != to_id)
	);

	-- Create indexes for better performance
	CREATE INDEX IF NOT EXISTS idx_message_history_to_id ON message_history(to_id);
	CREATE INDEX IF NOT EXISTS idx_message_history_timestamp ON message_history(timestamp);
	CREATE INDEX IF NOT EXISTS idx_message_history_from_to ON message_history(from_id, to_id, timestamp DESC);
	CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
	CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
	CREATE INDEX IF NOT EXISTS idx_message_reactions_conv_msg ON message_reactions(conversation_id, message_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
	CREATE INDEX IF NOT EXISTS idx_public_keys_created ON public_keys(created_at);
	CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);
	CREATE INDEX IF NOT EXISTS idx_push_tokens_id ON push_tokens(id);
	CREATE INDEX IF NOT EXISTS idx_friends_user_id_1 ON friends(user_id_1);
	CREATE INDEX IF NOT EXISTS idx_friends_user_id_2 ON friends(user_id_2);
	CREATE INDEX IF NOT EXISTS idx_friend_requests_from_id ON friend_requests(from_id);
	CREATE INDEX IF NOT EXISTS idx_friend_requests_to_id ON friend_requests(to_id);
	CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
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
