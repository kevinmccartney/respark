import {
  BadRequestException,
  NotFoundException,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import type { Server, WebSocket } from 'ws';
import { chatSendSchema, type ChatServerEvent } from 'schemas/chat';
import { verifyClerkToken } from '../auth/clerk';
import { CHAT_MAX_CONNECTIONS, CHAT_WS_PATH, CHAT_WS_PING_MS, WS_CLOSE } from './chat.constants';
import { ChatOrchestrator } from './orchestrator';
import { ChatService } from './chat.service';
import { tokenFromWsUrl } from './ws-auth';

type ClientState = {
  userId: string;
  busy: boolean;
};

@WebSocketGateway({ path: CHAT_WS_PATH })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly clients = new Map<WebSocket, ClientState>();
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly chat: ChatService,
    private readonly orchestrator: ChatOrchestrator,
    @InjectPinoLogger(ChatGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  afterInit() {
    this.logger.info({ event: 'chat.ws.init', path: CHAT_WS_PATH }, 'Chat WebSocket gateway ready');
    this.pingTimer = setInterval(() => {
      for (const client of this.clients.keys()) {
        if (client.readyState === 1) client.ping();
      }
    }, CHAT_WS_PING_MS);
  }

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    if (this.clients.size >= CHAT_MAX_CONNECTIONS) {
      client.close(WS_CLOSE.tryAgain, 'Too many chat connections');
      return;
    }

    const req = args[0] as IncomingMessage | undefined;
    const token = tokenFromWsUrl(req?.url);
    if (!token) {
      this.logger.warn({ event: 'chat.ws.auth_missing' }, 'WS connect missing token');
      client.close(WS_CLOSE.unauthorized, 'Missing token');
      return;
    }

    try {
      const userId = await verifyClerkToken(token);
      this.clients.set(client, { userId, busy: false });
      client.on('message', (raw) => {
        void this.handleRawMessage(client, raw);
      });
      this.logger.info({ event: 'chat.ws.connected', userId }, 'Chat WS client connected');
      this.safeSend(client, { event: 'ready', data: { ok: true } });
    } catch (err) {
      if (err instanceof UnauthorizedException && err.message.includes('not configured')) {
        client.close(4500, 'Auth not configured');
        return;
      }
      this.logger.warn({ event: 'chat.ws.auth_failed', err }, 'Chat WS auth failed');
      client.close(WS_CLOSE.unauthorized, 'Invalid token');
    }
  }

  handleDisconnect(client: WebSocket) {
    const state = this.clients.get(client);
    if (!state) return;
    this.clients.delete(client);
    this.logger.info(
      { event: 'chat.ws.disconnected', userId: state.userId },
      'Chat WS client disconnected',
    );
  }

  onModuleDestroy() {
    if (this.pingTimer) clearInterval(this.pingTimer);
  }

  private async handleRawMessage(client: WebSocket, raw: Buffer | ArrayBuffer | Buffer[]) {
    let parsed: { event?: string; data?: unknown };
    try {
      parsed = JSON.parse(String(raw)) as typeof parsed;
    } catch {
      return;
    }
    if (parsed.event !== 'chat.send') return;
    await this.handleChatSend(client, parsed.data);
  }

  private async handleChatSend(client: WebSocket, raw: unknown) {
    const state = this.clients.get(client);
    if (!state) return;

    const parsed = chatSendSchema.safeParse(raw);
    if (!parsed.success) {
      this.emitChat(client, { type: 'error', message: 'Invalid chat message.' });
      return;
    }

    if (state.busy) {
      this.emitChat(client, { type: 'error', message: 'Wait for the current reply to finish.' });
      return;
    }

    state.busy = true;
    const { message, context, conversationId } = parsed.data;
    const { deckId, cardId, view } = context;
    try {
      if (typeof deckId === 'string') await this.chat.requireOwnedDeck(state.userId, deckId);
      if (typeof cardId === 'string') await this.chat.requireCatalogCard(cardId);
      const conversation = await this.chat.loadOrCreateConversation(state.userId, conversationId, {
        deckId,
        cardId,
      });
      this.emitChat(client, {
        type: 'conversation',
        conversationId: conversation.id,
        deckId: conversation.deckId,
        cardId: conversation.cardId,
      });
      await this.chat.appendUserMessage(conversation.id, message);
      await this.orchestrator.runTurn({
        clerkUserId: state.userId,
        deckId: conversation.deckId,
        cardId: conversation.cardId,
        view,
        conversationId: conversation.id,
        emit: (event) => this.emitChat(client, event),
      });
    } catch (err) {
      if (err instanceof NotFoundException) {
        this.emitChat(client, { type: 'error', message: err.message });
        return;
      }
      if (err instanceof BadRequestException) {
        this.emitChat(client, { type: 'error', message: err.message });
        return;
      }
      this.logger.error(
        { event: 'chat.send_failed', err, userId: state.userId },
        'Chat send failed',
      );
      this.emitChat(client, { type: 'error', message: 'Something went wrong generating a reply.' });
    } finally {
      state.busy = false;
    }
  }

  private emitChat(client: WebSocket, data: ChatServerEvent) {
    this.safeSend(client, { event: 'chat', data });
  }

  private safeSend(client: WebSocket, payload: unknown) {
    try {
      client.send(JSON.stringify(payload));
    } catch {
      // client may have closed mid-send
    }
  }
}
