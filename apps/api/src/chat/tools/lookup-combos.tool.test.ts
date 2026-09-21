import { describe, expect, it, vi } from 'vitest';
import type { DeckCard, DeckDetail } from 'schemas/decks';
import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';
import type { SpellbookClient, SpellbookVariantSlice } from '../spellbook/types';
import { SpellbookUpstreamError } from '../spellbook/types';
import { lookupCombosTool } from './lookup-combos.tool';
import type { ToolContext } from './types';

const SOL = '00000000-0000-4000-8000-000000000004';
const TOP = '00000000-0000-4000-8000-0000000000aa';
const COMMANDER = '00000000-0000-4000-8000-000000000002';
const COMMANDER_PRINTING = '00000000-0000-4000-8000-000000000003';
const DECK = '00000000-0000-4000-8000-000000000001';

const line = (
  opts: Partial<DeckCard> & Pick<DeckCard, 'name' | 'cardId' | 'printingId'>,
): DeckCard => ({
  id: `line-${opts.cardId}`,
  cardId: opts.cardId,
  printingId: opts.printingId,
  name: opts.name,
  manaCost: null,
  manaValue: null,
  typeLine: null,
  oracleText: null,
  keywords: null,
  colorIdentity: [],
  foil: false,
  hasFoil: true,
  sideboard: opts.sideboard ?? false,
  quantity: opts.quantity ?? 1,
  setCode: 'c21',
  setName: 'Commander 2021',
  collectorNumber: '1',
  imageNormal: null,
  faces: [],
});

const deckDetail = (): DeckDetail => ({
  deck: {
    id: DECK,
    name: 'Tatyova lands',
    description: null,
    format: 'commander',
    commanderPrintingId: COMMANDER_PRINTING,
    colorIdentity: ['G', 'U'],
    updatedAt: new Date().toISOString(),
  },
  cards: [
    line({
      name: 'Tatyova, Benthic Druid',
      cardId: COMMANDER,
      printingId: COMMANDER_PRINTING,
    }),
    line({
      name: 'Sol Ring',
      cardId: SOL,
      printingId: '00000000-0000-4000-8000-000000000044',
    }),
  ],
});

const included: SpellbookVariantSlice = {
  id: 'combo-1',
  uses: [
    { name: 'Sol Ring', oracleId: SOL },
    { name: "Sensei's Divining Top", oracleId: TOP },
  ],
  produces: ['Infinite mana'],
  manaNeeded: '{1}',
  description: 'A'.repeat(500),
  popularity: 9,
  bracketTag: '2',
};

const ctx = (): ToolContext => ({
  clerkUserId: 'user_1',
  deckId: DECK,
  cardId: null,
  retrievedCardIds: new Set(),
});

const stubDecks = (): DecksService =>
  ({
    getForUser: vi.fn(async () => deckDetail()),
  }) as unknown as DecksService;

const stubCards = (): CardsService =>
  ({
    findByOracleIds: async (oracleIds: string[]) => {
      const map = new Map<string, { id: string; name: string }>();
      if (oracleIds.includes(SOL)) map.set(SOL, { id: SOL, name: 'Sol Ring' });
      return map;
    },
    findIdsByExactNames: async (names: string[]) => {
      const map = new Map<string, string>();
      if (names.some((name) => name.toLowerCase() === "sensei's divining top")) {
        map.set("sensei's divining top", TOP);
      }
      return map;
    },
  }) as unknown as CardsService;

describe('lookupCombosTool', () => {
  it('requires a deck or query', async () => {
    const tool = lookupCombosTool(stubDecks(), stubCards(), {
      findMyCombos: async () => ({ included: [], almostIncluded: [] }),
      searchVariants: async () => [],
    });
    const result = await tool.execute({}, { ...ctx(), deckId: null });
    expect(result).toEqual({
      ok: false,
      code: 'validation',
      message: 'Need a deck or a combo search query.',
    });
  });

  it('maps deck-mode combos, resolves catalog ids, and truncates descriptions', async () => {
    const spellbook: SpellbookClient = {
      findMyCombos: vi.fn(async () => ({
        included: [included],
        almostIncluded: [
          {
            id: 'combo-2',
            uses: [
              { name: 'Sol Ring', oracleId: SOL },
              { name: "Sensei's Divining Top", oracleId: null },
            ],
            produces: ['Infinite draw'],
            manaNeeded: null,
            description: 'Almost.',
            popularity: null,
            bracketTag: null,
          },
        ],
      })),
      searchVariants: async () => [],
    };
    const tool = lookupCombosTool(stubDecks(), stubCards(), spellbook);
    const result = await tool.execute({}, ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mode).toBe('deck');
    expect(result.data.included?.[0]?.uses).toEqual([
      { name: 'Sol Ring', catalogId: SOL, inDeck: true },
      { name: "Sensei's Divining Top", catalogId: TOP, inDeck: false },
    ]);
    expect(result.data.included?.[0]?.description).toHaveLength(400);
    expect(result.data.included?.[0]?.url).toBe('https://commanderspellbook.com/combo/combo-1');
    expect(result.data.almostIncluded?.[0]?.missing).toEqual([
      { name: "Sensei's Divining Top", catalogId: TOP, inDeck: false },
    ]);
    expect(spellbook.findMyCombos).toHaveBeenCalledWith({
      commanders: [{ card: 'Tatyova, Benthic Druid', quantity: 1 }],
      main: [{ card: 'Sol Ring', quantity: 1 }],
    });
  });

  it('searches variants when q is set', async () => {
    const spellbook: SpellbookClient = {
      findMyCombos: vi.fn(async () => ({ included: [], almostIncluded: [] })),
      searchVariants: vi.fn(async () => [included]),
    };
    const tool = lookupCombosTool(stubDecks(), stubCards(), spellbook);
    const result = await tool.execute({ q: 'card:"Sol Ring"' }, { ...ctx(), deckId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.mode).toBe('query');
    expect(result.data.variants?.[0]?.id).toBe('combo-1');
    expect(spellbook.findMyCombos).not.toHaveBeenCalled();
    expect(spellbook.searchVariants).toHaveBeenCalledWith('card:"Sol Ring"', 8);
  });

  it('returns upstream when Spellbook is down', async () => {
    const tool = lookupCombosTool(stubDecks(), stubCards(), {
      findMyCombos: async () => {
        throw new SpellbookUpstreamError('Spellbook returned 500');
      },
      searchVariants: async () => [],
    });
    const result = await tool.execute({}, ctx());
    expect(result).toEqual({
      ok: false,
      code: 'upstream',
      message: 'Spellbook returned 500',
    });
  });

  it('omits catalogId when the name is not in the catalog', async () => {
    const cards = {
      findByOracleIds: async () => new Map(),
      findIdsByExactNames: async () => new Map(),
    } as unknown as CardsService;
    const tool = lookupCombosTool(stubDecks(), cards, {
      findMyCombos: async () => ({
        included: [
          {
            ...included,
            uses: [{ name: 'Unknown Card', oracleId: null }],
          },
        ],
        almostIncluded: [],
      }),
      searchVariants: async () => [],
    });
    const result = await tool.execute({}, ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.included?.[0]?.uses[0]).toEqual({
      name: 'Unknown Card',
      catalogId: null,
      inDeck: false,
    });
  });
});
