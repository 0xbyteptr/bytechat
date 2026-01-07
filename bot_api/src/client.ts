import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type {
  BotConfig,
  InboundMessage,
  PresenceEvent,
  ReactionOptions,
  ReadReceiptOptions,
  SendMessageOptions,
} from "./types.js";

const DEFAULT_BASE = "https://api.byteptr.xyz";
const DEFAULT_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

type ClosePayload = { code: number; reason: string };
type ReconnectPayload = { delayMs: number };

export class BotClient extends EventEmitter {
  private ws?: WebSocket;
  private closed = false;
  private reconnectDelay: number;
  private readonly cfg: BotConfig;

  constructor(config: BotConfig) {
    super();
    if (!config.id) throw new Error("Bot id is required");
    if (!config.token) throw new Error("Bot token is required");
    this.cfg = config;
    this.reconnectDelay = config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    this.closed = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const onReady = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };
      const onClose = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Socket closed before ready"));
      };

      const cleanup = () => {
        this.off("ready", onReady);
        this.off("error", onError);
        this.off("close", onClose);
      };

      this.once("ready", onReady);
      this.once("error", onError);
      this.once("close", onClose);

      this.openSocket();
    });
  }

  disconnect(): void {
    this.closed = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, "client disconnect");
    }
  }

  sendRaw(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open; call connect() first");
    }
    this.ws.send(JSON.stringify(payload));
  }

  sendMessage(options: SendMessageOptions): void {
    const { to, payload } = options;
    this.sendRaw({ ...payload, to });
  }

  sendReaction(options: ReactionOptions): void {
    this.sendRaw({ type: "react", ...options });
  }

  sendReadReceipt(options: ReadReceiptOptions): void {
    this.sendRaw({ type: "read", ...options });
  }

  private openSocket(): void {
    const url = this.cfg.wsUrl ?? this.deriveWsUrl();
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.log(`connected -> ${url}`);
      ws.send(
        JSON.stringify({ type: "auth", id: this.cfg.id, token: this.cfg.token })
      );
    });

    ws.on("message", (data) => {
      const parsed = this.safeParse(data);
      if (!parsed) return;
      this.handleMessage(parsed);
    });

    ws.on("ping", (data) => {
      ws.pong(data);
    });

    ws.on("error", (err) => {
      this.emit("error", err);
    });

    ws.on("unexpected-response", (_, res) => {
      this.emit("error", new Error(`Unexpected response: ${res.statusCode}`));
    });

    ws.on("close", (code, reasonBuf) => {
      const reason = reasonBuf.toString();
      this.log(`socket closed code=${code} reason=${reason}`);
      this.emit("close", { code, reason } satisfies ClosePayload);
      if (this.closed) return;
      if (this.cfg.autoReconnect === false) return;
      this.scheduleReconnect();
    });
  }

  private handleMessage(msg: InboundMessage): void {
    if (msg && msg.type === "auth" && msg.status === "success") {
      this.reconnectDelay = this.cfg.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY;
      this.emit("ready");
      return;
    }

    if (msg && msg.type === "error") {
      const err = new Error(String((msg as { error?: unknown }).error ?? "socket error"));
      this.emit("error", err);
      return;
    }

    if (msg && msg.type === "presence" && Array.isArray((msg as { online?: unknown }).online)) {
      const presence: PresenceEvent = { online: (msg as { online: string[] }).online };
      this.emit("presence", presence);
      return;
    }

    if (msg && (msg as { isHistory?: unknown }).isHistory) {
      this.emit("history", msg);
      return;
    }

    this.emit("message", msg);
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectDelay;
    const nextDelay = Math.min(
      this.cfg.maxReconnectDelayMs ?? MAX_RECONNECT_DELAY,
      delay * 2
    );
    this.reconnectDelay = nextDelay;
    this.emit("reconnect", { delayMs: delay } satisfies ReconnectPayload);
    setTimeout(() => {
      if (this.closed) return;
      this.openSocket();
    }, delay);
  }

  private deriveWsUrl(): string {
    const base = this.cfg.baseUrl ?? DEFAULT_BASE;
    if (base.startsWith("ws")) return `${base.replace(/\/$/, "")}`;
    if (base.startsWith("http://")) return base.replace("http://", "ws://") + "/ws";
    if (base.startsWith("https://")) return base.replace("https://", "wss://") + "/ws";
    return `ws://${base.replace(/\/$/, "")}/ws`;
  }

  private safeParse(data: WebSocket.RawData): InboundMessage | null {
    try {
      const str = typeof data === "string" ? data : data.toString();
      return JSON.parse(str) as InboundMessage;
    } catch (err) {
      this.emit("debug", `failed to parse message: ${String(err)}`);
      return null;
    }
  }

  private log(msg: string): void {
    if (this.cfg.logger) {
      this.cfg.logger(msg);
    }
  }
}
