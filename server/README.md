# ByteChat server

Small Go HTTP and WebSocket gateway. Stores public keys, sessions, profiles, group metadata, and encrypted history; relays end-to-end–encrypted payloads.

## Run locally
- Install deps: `go mod tidy`
- Start: `go run main.go`
- Default listen port: 8080 (override with `PORT`).
- Max upload/WebSocket payload: `MAX_FILE_SIZE` bytes (default 50 MB).

## Auth basics
- Session token is returned by `/keys` after registration/verification.
- Supply the user id in `X-ByteChat-ID` where required.
- Supply the session token via `Authorization: Bearer <token>` or `X-Session-Token: <token>` (query param `?token=` also accepted for legacy).

## REST API

### Health
- `GET /health`
- Response: `200 OK`, plain text `OK`.

### Auth challenge and keys
- `POST /challenge`
	- Body: `{ "id": "alice", "publicKey": "<base64 32b>" }`
	- Returns encrypted challenge and server public key for NaCl box auth.
- `POST /keys`
	- Registration: body `{ "id": "alice", "publicKey": "<base64>" }` → creates key, session token `{ "token": "..." }`.
	- Verification: body `{ "id": "alice", "code": "<challenge code>" }` → saves key, returns session token.
- `GET /keys?id=<id>` → `{ "id": "alice", "publicKey": "..." }` or 404.

### Session validation
- `GET /validate-session?id=<id>` with token header → `200 OK` when valid, `401` otherwise.

### Push tokens (FCM)
- `POST /push-token`
	- Body: `{ "id": "alice", "token": "<fcmToken>", "sessionToken": "..." }`
	- Auth: session token required.
	- Response: `200 OK` on success.

### Profiles
- `GET /profile?id=<id>` → returns profile JSON, auto-creates empty profile when missing.
- `PUT /profile`
	- Body: complete profile `{ "id": "alice", ... }`.
	- Auth: token for `id` required.
	- Response: `204 No Content`.
- `POST /profile/status`
	- Body: `{ "status": "online|away|busy|offline", "customMessage": "optional" }`.
	- Auth: `X-ByteChat-ID` + token required.
	- Response: updated profile JSON; broadcasts status over WebSocket.

### Friends
- Base path: `/friends` (requires `X-ByteChat-ID` + token).
- `GET /friends?action=list` → array of friends.
- `GET /friends?action=requests` → incoming pending requests.
- `GET /friends?action=pending` → outgoing pending requests.
- `POST /friends?action=send-request` body `{ "toId": "bob" }` → `201 Created` with request info.
- `POST /friends?action=accept-request` body `{ "requestId": <int>, "fromId": "bob" }` → `200`.
- `POST /friends?action=reject-request` body `{ "requestId": <int> }` → `200`.
- `DELETE /friends?action=remove-friend` body `{ "friendId": "bob" }` → `200`.
- `DELETE /friends?action=cancel-request` body `{ "requestId": <int> }` → `200`.
- `DELETE /friends?action=block-user` body `{ "userIdToBlock": "bob" }` → `200`.

### Groups
- Base path: `/groups?id=<myId>` with token.
- `POST /groups`
	- Create or update a group. Body is a `Group` object; `id` must start with `#`.
	- If group exists, only the owner may update `members`/`name`.
	- If new, caller becomes owner and is auto-added to members.
	- Response: `{ "status": "success" }`.
- `GET /groups` → groups for the user id in query.

### CDN
- `POST /cdn/upload`
	- Multipart form field `file`.
	- Auth: `X-ByteChat-ID` + token.
	- Enforces `MAX_FILE_SIZE`.
	- Response: `{ "url": ".../cdn/file/<name>", "fileName": "...", "hash": "<sha256>" }`.
- `GET /cdn/file/<fileName>` → serves file or 404.

## WebSocket
- `GET /ws` upgrade.
- First client message must be `{ "type": "auth", "id": "alice", "token": "<session>" }`.
- Server responds `{ "type": "auth", "status": "success" }` then streams presence, history, chat, reactions, edits, deletes, reads, group events.
- Keepalive: server sends ping every 30s; clients should pong.
