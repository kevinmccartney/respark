import { describe, expect, it } from 'vitest';

import {
  countDeckChanges,
  diffDeck,
  type DeckSnapshot,
  snapshotWithDetails,
  type DeckSnapshotCard,
} from '@respark/schemas/deck-revisions';

const solRing = '00000000-0000-4000-8000-000000000001';
const bolt = '00000000-0000-4000-8000-000000000002';
const aesi = '00000000-0000-4000-8000-000000000003';

const card = (overrides: Partial<DeckSnapshotCard> & { cardId: string }): DeckSnapshotCard => ({
  printingId: overrides.cardId,
  name:
    overrides.cardId === solRing
      ? 'Sol Ring'
      : overrides.cardId === bolt
        ? 'Lightning Bolt'
        : 'Aesi',
  setCode: 'cmr',
  collectorNumber: '1',
  foil: false,
  sideboard: false,
  quantity: 1,
  ...overrides,
});

const snapshot = (
  cards: DeckSnapshotCard[],
  overrides: Partial<DeckSnapshot> = {},
): DeckSnapshot => ({
  name: 'Ramp',
  description: null,
  format: 'commander',
  commander: { printingId: aesi, name: 'Aesi' },
  cards,
  ...overrides,
});

describe('diffDeck', () => {
  it('reports nothing when the deck is unchanged', () => {
    const deck = snapshot([card({ cardId: solRing })]);
    expect(countDeckChanges(diffDeck(deck, deck))).toBe(0);
  });

  it('reports added and removed cards with their quantities', () => {
    const changes = diffDeck(
      snapshot([card({ cardId: solRing })]),
      snapshot([card({ cardId: bolt, quantity: 4 })]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({
        kind: 'added',
        name: 'Lightning Bolt',
        quantity: { from: 0, to: 4 },
      }),
      expect.objectContaining({ kind: 'removed', name: 'Sol Ring', quantity: { from: 1, to: 0 } }),
    ]);
  });

  it('reports a quantity change as an update', () => {
    const changes = diffDeck(
      snapshot([card({ cardId: bolt, quantity: 2 })]),
      snapshot([card({ cardId: bolt, quantity: 4 })]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({ kind: 'updated', quantity: { from: 2, to: 4 } }),
    ]);
  });

  it('reports a printing swap as a removal and an addition', () => {
    const newPrinting = '00000000-0000-4000-8000-0000000000c1';
    const changes = diffDeck(
      snapshot([card({ cardId: solRing, quantity: 2 })]),
      snapshot([
        card({
          cardId: solRing,
          printingId: newPrinting,
          setCode: 'c21',
          collectorNumber: '10',
          quantity: 2,
        }),
      ]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({ kind: 'added', setCode: 'c21', quantity: { from: 0, to: 2 } }),
      expect.objectContaining({ kind: 'removed', setCode: 'cmr', quantity: { from: 2, to: 0 } }),
    ]);
  });

  it('reports a foil toggle as a removal and an addition', () => {
    const changes = diffDeck(
      snapshot([card({ cardId: solRing })]),
      snapshot([card({ cardId: solRing, foil: true })]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({ kind: 'removed', foil: false }),
      expect.objectContaining({ kind: 'added', foil: true }),
    ]);
  });

  it('reports each stack of one card on its own', () => {
    const island = (printingId: string, collectorNumber: string, quantity: number) =>
      card({ cardId: bolt, printingId, setCode: 'm21', collectorNumber, quantity });
    const stackA = '00000000-0000-4000-8000-0000000000a1';
    const stackB = '00000000-0000-4000-8000-0000000000b1';
    const changes = diffDeck(
      snapshot([island(stackA, '263', 3), island(stackB, '264', 3)]),
      snapshot([island(stackA, '263', 2), island(stackB, '264', 4)]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({
        kind: 'updated',
        printingId: stackA,
        quantity: { from: 3, to: 2 },
      }),
      expect.objectContaining({
        kind: 'updated',
        printingId: stackB,
        quantity: { from: 3, to: 4 },
      }),
    ]);
  });

  it('keeps the same printing in main and sideboard as separate stacks', () => {
    const changes = diffDeck(
      snapshot([card({ cardId: bolt, quantity: 2 }), card({ cardId: bolt, sideboard: true })]),
      snapshot([card({ cardId: bolt, quantity: 3 }), card({ cardId: bolt, sideboard: true })]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({ kind: 'updated', sideboard: false, quantity: { from: 2, to: 3 } }),
    ]);
  });

  it('reports a move to the sideboard as a removal and an addition', () => {
    const changes = diffDeck(
      snapshot([card({ cardId: bolt })]),
      snapshot([card({ cardId: bolt, sideboard: true })]),
    );
    expect(changes.cards).toEqual([
      expect.objectContaining({ kind: 'removed', sideboard: false }),
      expect.objectContaining({ kind: 'added', sideboard: true }),
    ]);
  });

  it('reports deck detail changes, using commander names', () => {
    const changes = diffDeck(
      snapshot([], { name: 'Ramp', commander: { printingId: aesi, name: 'Aesi' } }),
      snapshot([], {
        name: 'Big Ramp',
        description: 'Lands matter',
        commander: { printingId: solRing, name: 'Tatyova' },
      }),
    );
    expect(changes.details).toEqual([
      { field: 'name', from: 'Ramp', to: 'Big Ramp' },
      { field: 'description', from: null, to: 'Lands matter' },
      { field: 'commander', from: 'Aesi', to: 'Tatyova' },
    ]);
  });

  it('treats every card as added when the deck was never saved', () => {
    const changes = diffDeck(null, snapshot([card({ cardId: solRing })]));
    expect(changes.cards).toEqual([expect.objectContaining({ kind: 'added', name: 'Sol Ring' })]);
    expect(changes.details).toEqual([]);
  });
});

describe('snapshotWithDetails', () => {
  it('takes the details but leaves unsaved card edits out', () => {
    const saved = snapshot([card({ cardId: solRing })]);
    const current = snapshot([card({ cardId: solRing, quantity: 2 }), card({ cardId: bolt })], {
      name: 'Big Ramp',
    });
    const next = snapshotWithDetails(saved, current);
    expect(next.name).toBe('Big Ramp');
    expect(next.cards).toEqual(saved.cards);
    expect(diffDeck(saved, next).cards).toEqual([]);
  });

  it("swaps the commander's main-board line along with the commander", () => {
    const tatyova = '00000000-0000-4000-8000-000000000004';
    const saved = snapshot([card({ cardId: aesi }), card({ cardId: solRing })]);
    const current = snapshot(
      [card({ cardId: tatyova, name: 'Tatyova' }), card({ cardId: solRing, quantity: 3 })],
      { commander: { printingId: tatyova, name: 'Tatyova' } },
    );
    const next = snapshotWithDetails(saved, current);
    expect(next.cards.map((line) => [line.name, line.quantity])).toEqual([
      ['Sol Ring', 1],
      ['Tatyova', 1],
    ]);
  });
});
