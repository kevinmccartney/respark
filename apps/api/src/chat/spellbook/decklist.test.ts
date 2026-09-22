import { describe, expect, it } from 'vitest';

import type { DeckCard, DeckDetail } from '@respark/schemas/decks';

import { toSpellbookDecklist } from './decklist';

const line = (opts: Partial<DeckCard> & Pick<DeckCard, 'name' | 'printingId'>): DeckCard => ({
  id: opts.id ?? `line-${opts.printingId}`,
  cardId: opts.cardId ?? '00000000-0000-4000-8000-000000000010',
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

const detail = (cards: DeckCard[], commanderPrintingId: string | null): DeckDetail => ({
  deck: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Test',
    description: null,
    format: 'commander',
    commanderPrintingId,
    colorIdentity: ['G', 'U'],
    updatedAt: new Date().toISOString(),
  },
  cards,
});

describe('toSpellbookDecklist', () => {
  it('splits the commander line from main and skips sideboard', () => {
    const commanderPrinting = '00000000-0000-4000-8000-000000000003';
    const mapped = toSpellbookDecklist(
      detail(
        [
          line({ name: 'Tatyova, Benthic Druid', printingId: commanderPrinting, quantity: 1 }),
          line({
            name: 'Sol Ring',
            printingId: '00000000-0000-4000-8000-000000000044',
            quantity: 1,
          }),
          line({
            name: 'Lightning Bolt',
            printingId: '00000000-0000-4000-8000-000000000088',
            sideboard: true,
          }),
        ],
        commanderPrinting,
      ),
    );
    expect(mapped).toEqual({
      commanders: [{ card: 'Tatyova, Benthic Druid', quantity: 1 }],
      main: [{ card: 'Sol Ring', quantity: 1 }],
    });
  });
});
