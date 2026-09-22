import { describe, expect, it } from 'vitest';

import type { DeckCard, DeckDetail } from '@respark/schemas/decks';

import { GET_DECK_LINE_CAP } from '../chat.constants';

import { keywordCounts, manaBucket, primaryType, toCompactDeck } from './compact-deck';

const line = (
  overrides: Partial<DeckCard> & Pick<DeckCard, 'cardId' | 'printingId' | 'name'>,
): DeckCard => ({
  id: overrides.id ?? overrides.cardId,
  manaCost: null,
  manaValue: '1',
  typeLine: 'Instant',
  oracleText: null,
  keywords: null,
  colorIdentity: ['U'],
  foil: false,
  hasFoil: true,
  sideboard: false,
  quantity: 1,
  setCode: 'lea',
  setName: 'Limited Edition Alpha',
  collectorNumber: '1',
  imageNormal: null,
  faces: [],
  ...overrides,
});

describe('primaryType', () => {
  it('reads the type before the em dash', () => {
    expect(primaryType('Legendary Creature — Elf Druid')).toBe('Creature');
  });

  it('falls back to Other', () => {
    expect(primaryType(null)).toBe('Other');
  });
});

describe('manaBucket', () => {
  it('caps at 7+', () => {
    expect(manaBucket('0')).toBe('0');
    expect(manaBucket('6.0')).toBe('6');
    expect(manaBucket('9')).toBe('7+');
    expect(manaBucket(null)).toBe('unknown');
  });
});

describe('toCompactDeck', () => {
  const commanderPrintingId = '00000000-0000-4000-8000-000000000010';
  const commanderCardId = '00000000-0000-4000-8000-000000000011';

  const detail = (
    cards: DeckCard[],
    format: DeckDetail['deck']['format'] = 'commander',
  ): DeckDetail => ({
    deck: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Simic value',
      description: null,
      format,
      commanderPrintingId: format === 'commander' ? commanderPrintingId : null,
      colorIdentity: ['G', 'U'],
      updatedAt: new Date().toISOString(),
    },
    cards,
  });

  it('uses the stored commander and omits image URLs', () => {
    const compact = toCompactDeck(
      detail([
        line({
          cardId: commanderCardId,
          printingId: commanderPrintingId,
          name: 'Tatyova, Benthic Druid',
          typeLine: 'Legendary Creature — Merfolk Druid',
          oracleText:
            'Landfall — Whenever a land you control enters, you gain 1 life and draw a card.',
          keywords: ['Landfall'],
          manaValue: '5',
          colorIdentity: ['G', 'U'],
          imageNormal: 'https://example.invalid/tatyova.jpg',
        }),
        line({
          cardId: '00000000-0000-4000-8000-000000000012',
          printingId: '00000000-0000-4000-8000-000000000013',
          name: 'Counterspell',
          manaValue: '2',
          sideboard: true,
        }),
      ]),
    );

    expect(compact.commander).toEqual({
      printingId: commanderPrintingId,
      cardId: commanderCardId,
      name: 'Tatyova, Benthic Druid',
      typeLine: 'Legendary Creature — Merfolk Druid',
      oracleText: 'Landfall — Whenever a land you control enters, you gain 1 life and draw a card.',
      keywords: ['Landfall'],
    });
    expect(compact.colorIdentity).toEqual(['G', 'U']);
    expect(compact.lines[0]).not.toHaveProperty('imageNormal');
    expect(compact.lines[0]?.keywords).toEqual(['Landfall']);
    expect(compact.stats.typeCounts.Creature).toBe(1);
    expect(compact.stats.typeCounts.Instant).toBeUndefined();
    expect(compact.stats.keywordCounts).toEqual({ Landfall: 1 });
    expect(compact.truncated).toBe(false);
  });

  it('keeps the top keyword counts by quantity', () => {
    expect(
      keywordCounts([
        line({
          cardId: '00000000-0000-4000-8000-000000000021',
          printingId: '00000000-0000-4000-8000-000000000022',
          name: 'A',
          keywords: ['Landfall', 'Flying'],
          quantity: 2,
        }),
        line({
          cardId: '00000000-0000-4000-8000-000000000023',
          printingId: '00000000-0000-4000-8000-000000000024',
          name: 'B',
          keywords: ['Landfall'],
          quantity: 1,
        }),
        line({
          cardId: '00000000-0000-4000-8000-000000000025',
          printingId: '00000000-0000-4000-8000-000000000026',
          name: 'C',
          keywords: ['Flash'],
          sideboard: true,
        }),
      ]),
    ).toEqual({ Landfall: 3, Flying: 2 });
  });

  it('truncates long lists', () => {
    const cards = Array.from({ length: GET_DECK_LINE_CAP + 3 }, (_, i) =>
      line({
        cardId: `00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
        printingId: `00000000-0000-4000-8001-${String(i + 100).padStart(12, '0')}`,
        name: `Card ${i}`,
      }),
    );
    const compact = toCompactDeck(detail(cards, 'standard'));
    expect(compact.lines).toHaveLength(GET_DECK_LINE_CAP);
    expect(compact.truncated).toBe(true);
    expect(compact.commander).toBeNull();
  });
});
