import { describe, expect, it, vi } from 'vitest';
import { SEARCH_CARDS_TOOL_MAX_LIMIT } from 'schemas/chat';
import type { CardSearchPage } from 'schemas/cards';
import type { DeckDetail } from 'schemas/decks';
import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';
import { searchCardsTool } from './search-cards.tool';

const deckId = '00000000-0000-4000-8000-000000000001';
const inDeckId = '00000000-0000-4000-8000-000000000004';

const detail: DeckDetail = {
  deck: {
    id: deckId,
    name: 'Simic',
    description: null,
    format: 'commander',
    commanderPrintingId: '00000000-0000-4000-8000-000000000010',
    colorIdentity: ['G', 'U'],
    updatedAt: new Date().toISOString(),
  },
  cards: [
    {
      id: 'line-1',
      cardId: inDeckId,
      printingId: '00000000-0000-4000-8000-000000000014',
      name: 'Sol Ring',
      manaCost: '{1}',
      manaValue: '1',
      typeLine: 'Artifact',
      oracleText: null,
      colorIdentity: [],
      foil: false,
      hasFoil: true,
      sideboard: false,
      quantity: 1,
      setCode: 'c21',
      setName: 'Commander 2021',
      collectorNumber: '1',
      imageNormal: null,
      faces: [],
    },
  ],
};

describe('searchCardsTool', () => {
  it('injects legalIn, commander identity, excludeCardIds, and caps limit at SEARCH_CARDS_TOOL_MAX_LIMIT', async () => {
    const search = vi.fn(async (): Promise<CardSearchPage> => ({
      cards: [],
      total: 0,
      page: 1,
      pageSize: 15,
      totalPages: 0,
    }));
    const tool = searchCardsTool(
      { getForUser: vi.fn(async () => detail) } as unknown as DecksService,
      { search } as unknown as CardsService,
    );

    await tool.execute(
      { q: 'draw', limit: 99 },
      { clerkUserId: 'user_1', deckId, cardId: null, retrievedCardIds: new Set() },
    );

    expect(search).toHaveBeenCalledWith({
      q: 'draw',
      typeContains: undefined,
      maxManaValue: undefined,
      legalIn: 'commander',
      colorIdentity: ['G', 'U'],
      excludeCardIds: [inDeckId],
      sort: 'edhrecRank',
      limit: SEARCH_CARDS_TOOL_MAX_LIMIT,
      page: 1,
    });
  });

  it('does not inject deck filters when there is no deck', async () => {
    const search = vi.fn(async (): Promise<CardSearchPage> => ({
      cards: [],
      total: 0,
      page: 1,
      pageSize: 15,
      totalPages: 0,
    }));
    const getForUser = vi.fn();
    const tool = searchCardsTool(
      { getForUser } as unknown as DecksService,
      { search } as unknown as CardsService,
    );

    await tool.execute(
      { q: 'counterspell', legalIn: 'modern', limit: 10 },
      { clerkUserId: 'user_1', deckId: null, cardId: null, retrievedCardIds: new Set() },
    );

    expect(getForUser).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith({
      q: 'counterspell',
      typeContains: undefined,
      maxManaValue: undefined,
      legalIn: 'modern',
      colorIdentity: undefined,
      excludeCardIds: [],
      sort: 'edhrecRank',
      limit: 10,
      page: 1,
    });
  });

  it('passes an explicit sort through', async () => {
    const search = vi.fn(async (): Promise<CardSearchPage> => ({
      cards: [],
      total: 0,
      page: 1,
      pageSize: 15,
      totalPages: 0,
    }));
    const tool = searchCardsTool(
      { getForUser: vi.fn() } as unknown as DecksService,
      { search } as unknown as CardsService,
    );

    await tool.execute(
      { q: 'bolt', sort: 'name' },
      { clerkUserId: 'user_1', deckId: null, cardId: null, retrievedCardIds: new Set() },
    );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'bolt',
        sort: 'name',
      }),
    );
  });
});
