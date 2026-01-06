# ByteChat — Minimal Privacy-Focused DM

yes, this **is** vibe coded. i use this app to communicate with my brother and family. expect bugs.

ByteChat is a minimal, privacy-oriented direct messaging prototype.

Key principles:
- End-to-end encryption (E2EE): messages are encrypted client-side using TweetNaCl (Curve25519/Xsalsa20-Poly1305). Server never sees plaintext.
- Server only relays encrypted blobs and provides a simple public-key registry (username → public key).
- Small, minimal codebase to study and extend.

Structure:
- `server/` — Go WebSocket relay + REST key registry
- `client/` — Vite + Svelte (TypeScript) frontend with basic chat UI and crypto utilities

See `server/README.md` and `client/README.md` for setup instructions and notes about privacy/design.
