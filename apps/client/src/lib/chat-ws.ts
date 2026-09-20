import type { GetToken } from './api.ts';
import { apiBaseUrl } from './api.ts';
import { chatWsEnvelopeSchema, type ChatSend, type ChatServerEvent } from 'schemas/chat';

export type ChatWsHandlers = {
  onEvent?: (event: ChatServerEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
};

const wsBaseUrl = (): string => {
  const http = apiBaseUrl();
  if (http.startsWith('https://')) return `wss://${http.slice('https://'.length)}`;
  if (http.startsWith('http://')) return `ws://${http.slice('http://'.length)}`;
  return http;
};

const warnInvalidWs = (kind: string, value: unknown, error?: { message: string }): void => {
  if (!import.meta.env.DEV) return;
  console.warn(`[chat-ws] dropped ${kind}`, error?.message ?? '', value);
};

/**
 * Connect to the player chat WebSocket. Sends Nest-ws envelopes:
 * `{ event, data }` for chat.send / incoming chat events.
 */
export const connectChatWs = (
  getToken: GetToken,
  handlers: ChatWsHandlers = {},
): { close: () => void; send: (payload: ChatSend) => void } => {
  let socket: WebSocket | null = null;
  let closed = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const pending: Array<{ event: string; data: unknown }> = [];

  const flushPending = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (pending.length > 0) {
      const msg = pending.shift()!;
      socket.send(JSON.stringify(msg));
    }
  };

  const sendEnvelope = (event: string, data: unknown) => {
    const msg = { event, data };
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    } else {
      pending.push(msg);
    }
  };

  const connect = async () => {
    if (closed) return;
    const token = await getToken();
    if (!token) {
      handlers.onError?.(new Event('auth'));
      scheduleReconnect();
      return;
    }

    const url = `${wsBaseUrl()}/chat/ws?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      reconnectAttempt = 0;
      flushPending();
      handlers.onOpen?.();
    };

    socket.onmessage = (ev) => {
      let json: unknown;
      try {
        json = JSON.parse(String(ev.data));
      } catch {
        warnInvalidWs('non-JSON message', ev.data);
        return;
      }

      const envelope = chatWsEnvelopeSchema.safeParse(json);
      if (!envelope.success) {
        warnInvalidWs('envelope', json, envelope.error);
        return;
      }

      if (envelope.data.event !== 'chat') return;
      handlers.onEvent?.(envelope.data.data);
    };

    socket.onerror = (err) => {
      handlers.onError?.(err);
    };

    socket.onclose = () => {
      handlers.onClose?.();
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  };

  void connect();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    },
    send: (payload: ChatSend) => sendEnvelope('chat.send', payload),
  };
};
