# server — ByteChat

Minimal Go server that provides:
- REST endpoints to publish/fetch user public keys: POST /keys, GET /keys?id=<id>
- WebSocket relay endpoint: /ws?id=<your-id>

Security model: server only stores public keys and relays encrypted messages. No plaintext is logged or stored.

Run:

1. Install dependencies: `go mod tidy`
2. Start server: `go run main.go`
3. Server listens on :8080 by default.

Messages: clients send JSON `{"to":"bob","cipher":"...","nonce":"..."}` to the server, and server forwards `{"from":"alice","cipher":"...","nonce":"..."}` to recipient if connected.
