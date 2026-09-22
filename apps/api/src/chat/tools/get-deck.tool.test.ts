import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { DeckDetail } from '@respark/schemas/decks';

import type { DecksService } from '../../decks/decks.service';

import { getDeckTool } from './get-deck.tool';
import type { ToolContext } from './types';

const deckId = '00000000-0000-4000-8000-000000000001';
const otherDeck = '00000000-0000-4000-8000-000000000099';

const detailFor = (id: string): DeckDetail => ({
  deck: {
    id,
    name: 'Simic',
    description: null,
    format: 'commander',
    commanderPrintingId: '00000000-0000-4000-8000-000000000010',
    colorIdentity: ['G', 'U'],
    updatedAt: new Date().toISOString(),
  },
  cards: [],
});

const ctx = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  clerkUserId: 'user_1',
  deckId,
  retrievedCardIds: new Set(),
  cardId: null,
  ...overrides,
});

describe('getDeckTool', () => {
  it('loads the sticky deck', async () => {
    const getForUser = vi.fn(async () => detailFor(deckId));
    const tool = getDeckTool({ getForUser } as unknown as DecksService);
    const result = await tool.execute({}, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(deckId);
    expect(getForUser).toHaveBeenCalledWith('user_1', deckId);
  });

  it('loads a model-supplied deck id and attaches it', async () => {
    const getForUser = vi.fn(async () => detailFor(otherDeck));
    const context = ctx({ deckId: null });
    const tool = getDeckTool({ getForUser } as unknown as DecksService);
    const result = await tool.execute({ deckId: otherDeck }, context);
    expect(result.ok).toBe(true);
    expect(context.deckId).toBe(otherDeck);
    expect(getForUser).toHaveBeenCalledWith('user_1', otherDeck);
  });

  it('returns no_deck_context when no sticky deck and no id', async () => {
    const getForUser = vi.fn();
    const tool = getDeckTool({ getForUser } as unknown as DecksService);
    const result = await tool.execute({}, ctx({ deckId: null }));
    expect(result).toEqual({
      ok: false,
      code: 'no_deck_context',
      message: 'this conversation has no deck',
    });
    expect(getForUser).not.toHaveBeenCalled();
  });

  it('surfaces ownership 404 as not_found via executeChatTool', async () => {
    const { executeChatTool } = await import('./registry');
    const tool = getDeckTool({
      getForUser: vi.fn(async () => {
        throw new NotFoundException('Deck not found');
      }),
    } as unknown as DecksService);
    const result = await executeChatTool(tool as never, {}, ctx());
    expect(result).toEqual({ ok: false, code: 'not_found', message: 'Deck not found' });
  });

  it('logs unexpected throws as internal', async () => {
    const { executeChatTool } = await import('./registry');
    const error = vi.fn();
    const tool = getDeckTool({
      getForUser: vi.fn(async () => {
        throw new Error('db down');
      }),
    } as unknown as DecksService);
    const result = await executeChatTool(tool as never, {}, ctx(), { error });
    expect(result).toEqual({ ok: false, code: 'internal', message: 'Tool failed' });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'chat.tool_failed', name: 'getDeck' }),
      'Chat tool threw',
    );
  });
});
