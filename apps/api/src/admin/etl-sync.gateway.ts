import type { IncomingMessage } from 'node:http';

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Subscription } from 'rxjs';
import type { Server, WebSocket } from 'ws';

import {
  etlWsSubscribeSchema,
  type EtlWsSubscribe,
  type SyncEvent,
} from '@respark/schemas/sync-event';

import { assertAdminUser, verifyClerkToken } from '../auth/clerk';

import { EtlSyncEventsService } from './etl-sync-events.service';

type ClientState = {
  userId: string;
  list: boolean;
  syncIds: Set<string>;
  sub: Subscription;
};

@WebSocketGateway({ path: '/admin/etl-syncs/ws' })
export class EtlSyncGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly clients = new Map<WebSocket, ClientState>();

  constructor(
    private readonly events: EtlSyncEventsService,
    @InjectPinoLogger(EtlSyncGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  afterInit() {
    this.logger.info(
      { event: 'admin.etl_sync.ws.init', path: '/admin/etl-syncs/ws' },
      'ETL sync WebSocket gateway ready',
    );
  }

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    const req = args[0] as IncomingMessage | undefined;
    const url = new URL(req?.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token')?.trim();

    if (!token) {
      this.logger.warn({ event: 'admin.etl_sync.ws.auth_missing' }, 'WS connect missing token');
      client.close(4401, 'Missing token');
      return;
    }

    try {
      const userId = await verifyClerkToken(token);
      await assertAdminUser(userId);

      const state: ClientState = {
        userId,
        // Default to list so progress reaches the syncs table even if
        // subscribe frames are delayed/missed.
        list: true,
        syncIds: new Set(),
        sub: this.events.events().subscribe((event) => {
          this.forward(client, state, event);
        }),
      };
      this.clients.set(client, state);

      // Raw fallback: Nest @SubscribeMessage param binding is easy to get wrong
      // with the native `ws` adapter; also accept plain { event, data } here.
      client.on('message', (raw) => {
        this.handleRawMessage(client, raw);
      });

      this.logger.info({ event: 'admin.etl_sync.ws.connected', userId }, 'WS client connected');
      this.safeSend(client, { event: 'ready', data: { ok: true } });
    } catch (err) {
      if (err instanceof ForbiddenException) {
        this.logger.warn(
          { event: 'admin.etl_sync.ws.forbidden' },
          'WS connect rejected: not admin',
        );
        client.close(4403, 'Admin role required');
        return;
      }
      if (err instanceof UnauthorizedException && err.message.includes('not configured')) {
        client.close(4500, 'Auth not configured');
        return;
      }
      this.logger.warn({ event: 'admin.etl_sync.ws.auth_failed', err }, 'WS auth failed');
      client.close(4401, 'Invalid token');
    }
  }

  handleDisconnect(client: WebSocket) {
    const state = this.clients.get(client);
    if (state) {
      state.sub.unsubscribe();
      this.clients.delete(client);
      this.logger.info(
        { event: 'admin.etl_sync.ws.disconnected', userId: state.userId },
        'WS client disconnected',
      );
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: EtlWsSubscribe,
  ): { event: string; data: { ok: boolean; error?: string } } {
    return {
      event: 'subscribe',
      data: this.applySubscribe(client, data),
    };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: EtlWsSubscribe,
  ): { event: string; data: { ok: boolean } } {
    return {
      event: 'unsubscribe',
      data: this.applyUnsubscribe(client, data),
    };
  }

  private handleRawMessage(client: WebSocket, raw: Buffer | ArrayBuffer | Buffer[]) {
    let parsed: { event?: string; data?: unknown };
    try {
      parsed = JSON.parse(String(raw)) as typeof parsed;
    } catch {
      return;
    }
    if (parsed.event === 'subscribe') {
      const result = this.applySubscribe(client, parsed.data);
      this.safeSend(client, { event: 'subscribe', data: result });
      return;
    }
    if (parsed.event === 'unsubscribe') {
      const result = this.applyUnsubscribe(client, parsed.data);
      this.safeSend(client, { event: 'unsubscribe', data: result });
    }
  }

  private applySubscribe(client: WebSocket, raw: unknown): { ok: boolean; error?: string } {
    const state = this.clients.get(client);
    if (!state) return { ok: false, error: 'not authenticated' };

    const parsed = etlWsSubscribeSchema.safeParse(raw ?? {});
    if (!parsed.success) return { ok: false, error: 'invalid subscribe' };
    const data = parsed.data;

    if (data.channel === 'list') {
      state.list = true;
      this.logger.debug(
        { event: 'admin.etl_sync.ws.subscribe_list', userId: state.userId },
        'Client subscribed to list',
      );
      return { ok: true };
    }
    if (data.channel === 'sync' && data.syncId) {
      state.syncIds.add(data.syncId);
      this.logger.debug(
        {
          event: 'admin.etl_sync.ws.subscribe_sync',
          userId: state.userId,
          syncId: data.syncId,
        },
        'Client subscribed to sync',
      );
      return { ok: true };
    }
    return { ok: false, error: 'invalid subscribe' };
  }

  private applyUnsubscribe(client: WebSocket, raw: unknown): { ok: boolean } {
    const state = this.clients.get(client);
    if (!state) return { ok: false };

    const parsed = etlWsSubscribeSchema.safeParse(raw ?? {});
    if (!parsed.success) return { ok: false };
    const data = parsed.data;

    if (data.channel === 'list') {
      state.list = false;
    }
    if (data.channel === 'sync' && data.syncId) {
      state.syncIds.delete(data.syncId);
    }
    return { ok: true };
  }

  private forward(client: WebSocket, state: ClientState, event: SyncEvent) {
    if (client.readyState !== 1 /* WebSocket.OPEN */) return;

    const syncId = syncIdOf(event);
    const forList =
      state.list &&
      (event.type === 'sync.started' ||
        event.type === 'sync.updated' ||
        event.type === 'sync.completed' ||
        event.type === 'job.progress' ||
        event.type === 'job.started' ||
        event.type === 'job.completed');
    const forDetail = syncId !== null && state.syncIds.has(syncId);

    if (!forList && !forDetail) return;

    this.safeSend(client, { event: 'etl', data: event });
  }

  private safeSend(client: WebSocket, payload: unknown) {
    try {
      client.send(JSON.stringify(payload));
    } catch {
      // client may have closed mid-send
    }
  }
}

const syncIdOf = (event: SyncEvent): string | null => {
  if (event.type === 'sync.started') return event.sync.id;
  if ('syncId' in event) return event.syncId;
  return null;
};
