-- Initialize ByteChat Database
-- Run this as a PostgreSQL superuser if the database doesn't exist
-- Usage: psql -U postgres -f init-db.sql

-- Create the bytechat database if it doesn't exist
CREATE DATABASE bytechat;

-- Connect to the database
\c bytechat

-- Create tables
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
