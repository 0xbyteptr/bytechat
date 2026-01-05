# client — ByteChat Svelte UI

Minimal Svelte + Vite client that demonstrates:
- Client-side key generation (TweetNaCl)
- Register public key with the server (POST /keys)
- Connect to WebSocket (/ws?id=...) to send/receive encrypted messages
- Simple UI for sending E2EE messages to a contact

Quick start:

1. cd client
2. npm install
3. npm run dev

See `src/lib/crypto.ts` for encryption helpers.
