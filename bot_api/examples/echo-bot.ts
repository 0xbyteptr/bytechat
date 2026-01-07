import { BotClient } from "../src/index.js";

const id = process.env.BYTECHAT_BOT_ID || "bot.example";
const token = process.env.BYTECHAT_BOT_TOKEN || "";
const wsUrl = process.env.BYTECHAT_WS || "ws://localhost:8080/ws";

if (!token) {
  console.error("Set BYTECHAT_BOT_TOKEN before running the example.");
  process.exit(1);
}

const bot = new BotClient({
  id,
  token,
  wsUrl,
  autoReconnect: true,
  logger: (msg) => console.log(`[bot] ${msg}`),
});

bot.on("ready", () => console.log("[bot] ready"));
bot.on("presence", (p) => console.log(`[bot] online: ${p.online.length}`));
bot.on("reconnect", ({ delayMs }) => console.log(`[bot] reconnecting in ${delayMs}ms`));
bot.on("error", (err) => console.error("[bot] error", err));

bot.on("history", (msg) => {
  const from = (msg as { from?: string }).from;
  const text = (msg as { text?: string }).text;
  if (!from || typeof text !== "string") return;
  console.log(`[history] ${from}: ${text}`);
});

bot.on("message", (msg) => {
  const from = (msg as { from?: string }).from;
  const text = (msg as { text?: string }).text;
  if (!from || typeof text !== "string") return;
  console.log(`[msg] ${from}: ${text}`);
  bot.sendMessage({
    to: from,
    payload: { type: "text", text: `echo: ${text}` },
  });
});

bot.connect().catch((err) => {
  console.error("Failed to connect", err);
  process.exit(1);
});
