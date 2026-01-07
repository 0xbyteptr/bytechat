# ByteChat Bot API (TypeScript)

TypeScript toolkit for building bots for ByteChat over WebSocket, similar to Discord/Telegram bot SDKs. Provides a simple `BotClient` with event-driven APIs, reconnection, and helpers to send messages, reactions, and read receipts.

## Quick start

```bash
cd bot_api
pnpm install
pnpm dev # runs examples/echo-bot.ts
```

Set environment variables for the example:

```bash
export BYTECHAT_BOT_ID="bot.example"
export BYTECHAT_BOT_TOKEN="<session-token>"
export BYTECHAT_WS="ws://localhost:8080/ws" # optional, defaults to local
pnpm dev
```

## Usage (library)

```ts
import { BotClient } from "./dist"; // or from "./src" in dev

const bot = new BotClient({
  id: "bot.example",
  token: process.env.BYTECHAT_BOT_TOKEN!,
  wsUrl: "ws://localhost:8080/ws",
  autoReconnect: true,
  logger: console.log,
});

bot.on("ready", () => console.log("bot ready"));
bot.on("message", (msg) => {
  const from = msg.from;
  if (!from) return;
  const text = typeof msg.text === "string" ? msg.text : "";
  bot.sendMessage({ to: from, payload: { type: "text", text: `echo: ${text}` } });
});

bot.connect();
```

## Events

- `ready` — authentication succeeded and socket is open
- `message` — new inbound message (live)
- `history` — historical messages replayed on connect (`isHistory: true`)
- `presence` — presence snapshot `{ online: string[] }`
- `reconnect` — auto-reconnect scheduled with `{ delayMs }`
- `close` — socket closed `{ code, reason }`
- `error` — low-level socket errors

## API surface

- `connect()` / `disconnect()` — manage lifecycle
- `sendMessage({ to, payload })` — send arbitrary payload to a user or group (`to` can be `#groupId`)
- `sendReaction({ to, messageId, emoji })` — toggle reaction on a message
- `sendReadReceipt({ from })` — mark a message from `from` as read
- `sendRaw(payload)` — send a custom envelope if you need full control

### Message envelope

The ByteChat server expects the first message to be an auth envelope:

```json
{ "type": "auth", "id": "bot.example", "token": "<session-token>" }
```

After auth, send messages shaped like:

```json
{ "to": "user-or-#group", "type": "text", "text": "hello" }
```

The server will inject `from` and delivery metadata. History messages include `isHistory: true`.

## Notes

- Uses the ByteChat WebSocket endpoint at `/ws`.
- Auto-reconnect uses exponential backoff (1s -> 2s -> 4s ... capped at 30s).
- Reactions and read receipts follow the server semantics in `server/websocket/websocket.go`.
- For production, build once (`pnpm build`) and import from `dist/`.
