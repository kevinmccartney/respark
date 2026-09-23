import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WS_CLOSE } from './chat.constants';

vi.mock('../auth/clerk', () => ({
  verifyClerkToken: vi.fn(async (token: string) => {
    if (token === 'good') return 'user_1';
    throw new UnauthorizedException('Invalid session token');
  }),
}));

class FakeSocket {
  readyState = 1;
  closeCode?: number;
  closeReason?: string;
  sent: unknown[] = [];
  private readonly handlers = new Map<string, Array<(raw: Buffer) => void>>();

  close(code: number, reason: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3;
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as unknown);
  }

  ping() {}

  on(event: string, fn: (raw: Buffer) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(fn);
    this.handlers.set(event, list);
  }

  emit(event: string, raw: Buffer) {
    for (const fn of this.handlers.get(event) ?? []) fn(raw);
  }
}

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as unknown as PinoLogger;

describe('ChatGateway', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('closes 4401 when the token is missing', async () => {
    const { ChatGateway } = await import('./chat.gateway');
    const gateway = new ChatGateway({} as never, {} as never, silentLogger);
    const client = new FakeSocket();
    await gateway.handleConnection(client as never, { url: '/chat/ws' });
    expect(client.closeCode).toBe(WS_CLOSE.unauthorized);
  });

  it('emits an error when the deck is not owned', async () => {
    const { ChatGateway } = await import('./chat.gateway');
    const chat = {
      requireOwnedDeck: vi.fn(async () => {
        throw new NotFoundException('Deck not found');
      }),
    };
    const gateway = new ChatGateway(chat as never, { runTurn: vi.fn() } as never, silentLogger);
    const client = new FakeSocket();
    await gateway.handleConnection(client as never, { url: '/chat/ws?token=good' });
    client.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'chat.send',
          data: {
            message: 'hi',
            context: { deckId: '00000000-0000-4000-8000-000000000001' },
          },
        }),
      ),
    );
    await vi.waitFor(() => {
      expect(client.sent.some((row) => JSON.stringify(row).includes('Deck not found'))).toBe(true);
    });
  });

  it('skips deck ownership when the send has no deck', async () => {
    const { ChatGateway } = await import('./chat.gateway');
    const chat = {
      requireOwnedDeck: vi.fn(),
      requireCatalogCard: vi.fn(),
      loadOrCreateConversation: vi.fn(async () => ({
        id: '00000000-0000-4000-8000-0000000000cc',
        deckId: null,
        cardId: null,
      })),
      appendUserMessage: vi.fn(),
    };
    const orchestrator = { runTurn: vi.fn(async () => undefined) };
    const gateway = new ChatGateway(chat as never, orchestrator as never, silentLogger);
    const client = new FakeSocket();
    await gateway.handleConnection(client as never, { url: '/chat/ws?token=good' });
    client.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'chat.send',
          data: { message: 'Suggest a counterspell' },
        }),
      ),
    );
    await vi.waitFor(() => {
      expect(orchestrator.runTurn).toHaveBeenCalled();
    });
    expect(chat.requireOwnedDeck).not.toHaveBeenCalled();
    expect(chat.requireCatalogCard).not.toHaveBeenCalled();
    expect(chat.loadOrCreateConversation).toHaveBeenCalledWith('user_1', undefined, {
      deckId: undefined,
      cardId: undefined,
    });
    expect(orchestrator.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: 'user_1',
        deckId: null,
        cardId: null,
      }),
    );
  });

  it('does not reject a follow-up whose deckId differs from the stored sticky deck', async () => {
    const { ChatGateway } = await import('./chat.gateway');
    const nextDeck = '00000000-0000-4000-8000-000000000002';
    const conversationId = '00000000-0000-4000-8000-0000000000cc';
    const chat = {
      requireOwnedDeck: vi.fn(async () => undefined),
      requireCatalogCard: vi.fn(),
      loadOrCreateConversation: vi.fn(async () => ({
        id: conversationId,
        deckId: nextDeck,
        cardId: null,
      })),
      appendUserMessage: vi.fn(),
    };
    const orchestrator = { runTurn: vi.fn(async () => undefined) };
    const gateway = new ChatGateway(chat as never, orchestrator as never, silentLogger);
    const client = new FakeSocket();
    await gateway.handleConnection(client as never, { url: '/chat/ws?token=good' });
    client.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'chat.send',
          data: {
            conversationId,
            message: 'now this list',
            context: { deckId: nextDeck },
          },
        }),
      ),
    );
    await vi.waitFor(() => {
      expect(orchestrator.runTurn).toHaveBeenCalled();
    });
    expect(chat.requireOwnedDeck).toHaveBeenCalledWith('user_1', nextDeck);
    expect(chat.loadOrCreateConversation).toHaveBeenCalledWith('user_1', conversationId, {
      deckId: nextDeck,
      cardId: undefined,
    });
    expect(client.sent.some((row) => JSON.stringify(row).toLowerCase().includes('mismatch'))).toBe(
      false,
    );
  });

  it('emits an error when the card is missing from the catalog', async () => {
    const { ChatGateway } = await import('./chat.gateway');
    const chat = {
      requireOwnedDeck: vi.fn(),
      requireCatalogCard: vi.fn(async () => {
        throw new NotFoundException('Card not found');
      }),
    };
    const gateway = new ChatGateway(chat as never, { runTurn: vi.fn() } as never, silentLogger);
    const client = new FakeSocket();
    await gateway.handleConnection(client as never, { url: '/chat/ws?token=good' });
    client.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'chat.send',
          data: {
            message: 'what does this do?',
            context: { cardId: '00000000-0000-4000-8000-000000000005' },
          },
        }),
      ),
    );
    await vi.waitFor(() => {
      expect(client.sent.some((row) => JSON.stringify(row).includes('Card not found'))).toBe(true);
    });
  });

  it('uses the stored sticky card when the send omits cardId', async () => {
    const { ChatGateway } = await import('./chat.gateway');
    const conversationId = '00000000-0000-4000-8000-0000000000cc';
    const storedCard = '00000000-0000-4000-8000-000000000005';
    const chat = {
      requireOwnedDeck: vi.fn(),
      requireCatalogCard: vi.fn(),
      loadOrCreateConversation: vi.fn(async () => ({
        id: conversationId,
        deckId: null,
        cardId: storedCard,
      })),
      appendUserMessage: vi.fn(),
    };
    const orchestrator = { runTurn: vi.fn(async () => undefined) };
    const gateway = new ChatGateway(chat as never, orchestrator as never, silentLogger);
    const client = new FakeSocket();
    await gateway.handleConnection(client as never, { url: '/chat/ws?token=good' });
    client.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          event: 'chat.send',
          data: { conversationId, message: 'tell me more about it' },
        }),
      ),
    );
    await vi.waitFor(() => {
      expect(orchestrator.runTurn).toHaveBeenCalled();
    });
    expect(chat.requireCatalogCard).not.toHaveBeenCalled();
    expect(chat.loadOrCreateConversation).toHaveBeenCalledWith('user_1', conversationId, {
      deckId: undefined,
      cardId: undefined,
    });
    expect(orchestrator.runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: storedCard }),
    );
  });
});
