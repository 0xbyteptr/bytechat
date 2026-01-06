# ByteChat Server Setup

## Prerequisites

- Go 1.24.0 or higher
- PostgreSQL 16 (or use Docker)
- Optional: Docker and Docker Compose

## Quick Start with Docker

### 1. Start PostgreSQL using Docker Compose

```bash
cd /home/byte/bytechat
docker-compose up -d
```

This will start PostgreSQL with:
- User: `bytechat`
- Password: `bytechat`
- Database: `bytechat`
- Port: `5432`

### 2. Configure Environment Variables

The `.env` file should already be configured with:

```env
DATABASE_URL=postgres://bytechat:bytechat@localhost:5432/bytechat?sslmode=disable
PORT=8080
MAX_FILE_SIZE=52428800
```

### 3. Run the Server

```bash
cd server
go run .
```

The server will:
- Connect to PostgreSQL
- Create necessary tables automatically
- Start listening on port 8080

## Manual PostgreSQL Setup

If you want to use an existing PostgreSQL installation:

1. Create database and user:

```sql
CREATE USER bytechat WITH PASSWORD 'bytechat';
CREATE DATABASE bytechat OWNER bytechat;
```

2. Update `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgres://bytechat:YOUR_PASSWORD@YOUR_HOST:5432/bytechat?sslmode=disable
```

3. Run the server:

```bash
cd server
go run .
```

## Database Schema

The server automatically creates the following tables:
- `public_keys` - User public keys
- `sessions` - Session tokens
- `groups` - Chat groups
- `group_members` - Group membership
- `group_admins` - Group administrators
- `group_settings` - Group configuration
- `message_history` - Encrypted message history
- `push_tokens` - FCM push notification tokens

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://bytechat:bytechat@localhost:5432/bytechat?sslmode=disable` | PostgreSQL connection string |
| `PORT` | `8080` | Server port |
| `MAX_FILE_SIZE` | `52428800` (50MB) | Maximum file upload size |
| `FCM_SERVER_KEY` | (empty) | Firebase Cloud Messaging server key |
| `DEBUG` | `false` | Enable debug mode |

## API Endpoints

- `GET /health` - Health check
- `POST /challenge` - Start authentication challenge
- `GET /keys` - Get user public key
- `POST /push-token` - Register push notification token
- `GET /groups` - Get user's groups
- `POST /groups` - Create new group
- `PUT /groups/{id}` - Update group
- `DELETE /groups/{id}` - Delete group
- `GET /validate-session` - Validate session token
- `POST /cdn/upload` - Upload file
- `GET /cdn/file/{id}` - Download file
- `WS /ws` - WebSocket connection

## Troubleshooting

### Database Connection Error

```
failed to connect to database: connection refused
```

**Solution**: Ensure PostgreSQL is running:
```bash
docker-compose ps
# or for manual setup:
sudo systemctl status postgresql
```

### Port Already in Use

```
listen tcp :8080: bind: address already in use
```

**Solution**: Change PORT in `.env` or kill the process using the port:
```bash
lsof -i :8080
kill -9 <PID>
```

### Table Creation Error

If you see errors about table creation, check that the `bytechat` user has proper permissions:

```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bytechat;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO bytechat;
```

## Development

To rebuild the server:

```bash
cd server
go build -o bytechat
./bytechat
```

To run tests:

```bash
cd server
go test ./...
```
