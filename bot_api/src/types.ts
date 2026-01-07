export type BotEvent =
  | "ready"
  | "message"
  | "history"
  | "presence"
  | "reconnect"
  | "close"
  | "error"
  | "debug";

export interface BotConfig {
  id: string;
  token: string;
  baseUrl?: string;
  wsUrl?: string;
  autoReconnect?: boolean;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  logger?: (msg: string) => void;
}

export interface SendMessageOptions {
  to: string;
  payload: Record<string, unknown>;
}

export interface ReactionOptions {
  to: string;
  messageId: string;
  emoji: string;
}

export interface ReadReceiptOptions {
  from: string;
}

export type InboundMessage = Record<string, unknown>;

export interface PresenceEvent {
  online: string[];
}
