import type { SyncEvent } from './sync-events.ts';
import { apiBaseUrl } from './api.ts';

type GetToken = () => Promise<string | null>;

export type EtlWsHandlers = {
  onEvent?: (event: SyncEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
};

function wsBaseUrl(): string {
  const http = apiBaseUrl();
  if (http.startsWith('https://')) return `wss://${http.slice('https://'.length)}`;
  if (http.startsWith('http://')) return `ws://${http.slice('http://'.length)}`;
  return http;
}

/**
 * Connect to the admin ETL sync WebSocket. Sends Nest-ws envelopes:
 * `{ event, data }` for subscribe / incoming etl events.
 */
export function connectEtlSyncWs(
  getToken: GetToken,
  handlers: EtlWsHandlers = {},
): { close: () => void; subscribeList: () => void; subscribeSync: (id: string) => void } {
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

  const send = (event: string, data: unknown) => {
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

    const url = `${wsBaseUrl()}/admin/etl-syncs/ws?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      reconnectAttempt = 0;
      flushPending();
      handlers.onOpen?.();
    };

    socket.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as {
          event?: string;
          data?: SyncEvent;
        };
        if (parsed.event === 'etl' && parsed.data) {
          handlers.onEvent?.(parsed.data);
        }
        // 'ready' / 'subscribe' acks are informational; ignore here
      } catch {
        // ignore malformed
      }
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
    subscribeList: () => send('subscribe', { channel: 'list' }),
    subscribeSync: (syncId: string) => send('subscribe', { channel: 'sync', syncId }),
  };
}
