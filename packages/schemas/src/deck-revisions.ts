import { z } from 'zod';

import { DECK_DETAIL_FIELDS, deckFormatSchema, type DeckDetail } from './decks.js';
import { isoDateTimeSchema, queryIntSchema, uuidSchema } from './primitives.js';

export const DECK_SAVE_NOTE_MAX_LENGTH = 1000;
export const DECK_REVISIONS_DEFAULT_LIMIT = 20;
export const DECK_REVISIONS_MAX_LIMIT = 100;

/** Names and set codes are copied in so the changelog can describe cards that were later removed. */
export const deckSnapshotCardSchema = z.object({
  cardId: uuidSchema,
  printingId: uuidSchema,
  name: z.string(),
  setCode: z.string(),
  collectorNumber: z.string(),
  foil: z.boolean(),
  sideboard: z.boolean(),
  quantity: z.number().int(),
});

export type DeckSnapshotCard = z.infer<typeof deckSnapshotCardSchema>;

export const deckSnapshotSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  format: deckFormatSchema,
  commander: z.object({ printingId: uuidSchema, name: z.string() }).nullable(),
  cards: z.array(deckSnapshotCardSchema),
});

export type DeckSnapshot = z.infer<typeof deckSnapshotSchema>;

export const DECK_CARD_CHANGE_KINDS = ['added', 'removed', 'updated'] as const;

const changeOf = <S extends z.ZodType>(schema: S) => z.object({ from: schema, to: schema });

/** A change to one stack (printing + foil + board); swapping printings is a removal plus an addition. */
export const deckCardChangeSchema = z.object({
  kind: z.enum(DECK_CARD_CHANGE_KINDS),
  cardId: uuidSchema,
  printingId: uuidSchema,
  name: z.string(),
  setCode: z.string(),
  collectorNumber: z.string(),
  foil: z.boolean(),
  sideboard: z.boolean(),
  /** Copies in this stack; `from` is 0 when added, `to` is 0 when removed. */
  quantity: changeOf(z.number().int()),
});

export type DeckCardChange = z.infer<typeof deckCardChangeSchema>;

export const deckDetailChangeSchema = z.object({
  field: z.enum(DECK_DETAIL_FIELDS),
  from: z.string().nullable(),
  to: z.string().nullable(),
});

export type DeckDetailChange = z.infer<typeof deckDetailChangeSchema>;

export const deckChangesSchema = z.object({
  cards: z.array(deckCardChangeSchema),
  details: z.array(deckDetailChangeSchema),
});

export type DeckChanges = z.infer<typeof deckChangesSchema>;

export const deckRevisionSchema = z.object({
  id: uuidSchema,
  createdAt: isoDateTimeSchema,
  note: z.string().nullable(),
  changes: deckChangesSchema,
});

export type DeckRevision = z.infer<typeof deckRevisionSchema>;

export const deckRevisionResponseSchema = z.object({
  revision: deckRevisionSchema,
});

export type DeckRevisionResponse = z.infer<typeof deckRevisionResponseSchema>;

/** The last saved state; `snapshot` is null only for a deck that has never been saved. */
export const deckSavedStateSchema = z.object({
  revisionId: uuidSchema.nullable(),
  savedAt: isoDateTimeSchema.nullable(),
  snapshot: deckSnapshotSchema.nullable(),
});

export type DeckSavedState = z.infer<typeof deckSavedStateSchema>;

export const deckRevisionsPageSchema = z.object({
  revisions: z.array(deckRevisionSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export type DeckRevisionsPage = z.infer<typeof deckRevisionsPageSchema>;

export const deckRevisionsQuerySchema = z.object({
  limit: queryIntSchema(1, DECK_REVISIONS_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type DeckRevisionsQuery = z.infer<typeof deckRevisionsQuerySchema>;

export const saveDeckBodySchema = z
  .object({
    note: z.string().trim().max(DECK_SAVE_NOTE_MAX_LENGTH).optional(),
  })
  .strict();

export type SaveDeckBody = z.infer<typeof saveDeckBodySchema>;

export const EMPTY_DECK_CHANGES: DeckChanges = { cards: [], details: [] };

export const countDeckChanges = (changes: DeckChanges): number =>
  changes.cards.length + changes.details.length;

export const deckSnapshotFromDetail = (detail: DeckDetail): DeckSnapshot => {
  const { deck } = detail;
  const commanderCard = deck.commanderPrintingId
    ? detail.cards.find((card) => card.printingId === deck.commanderPrintingId && !card.sideboard)
    : undefined;
  return {
    name: deck.name,
    description: deck.description,
    format: deck.format,
    commander:
      deck.commanderPrintingId && commanderCard
        ? { printingId: deck.commanderPrintingId, name: commanderCard.name }
        : null,
    cards: detail.cards.map((card) => ({
      cardId: card.cardId,
      printingId: card.printingId,
      name: card.name,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      foil: card.foil,
      sideboard: card.sideboard,
      quantity: card.quantity,
    })),
  };
};

const stackKey = (card: DeckSnapshotCard) =>
  `${card.printingId}:${card.foil ? 1 : 0}:${card.sideboard ? 'side' : 'main'}`;

const diffCards = (prev: DeckSnapshotCard[], next: DeckSnapshotCard[]): DeckCardChange[] => {
  const before = new Map(prev.map((card) => [stackKey(card), card]));
  const after = new Map(next.map((card) => [stackKey(card), card]));
  const changes: DeckCardChange[] = [];

  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const prevCard = before.get(key);
    const nextCard = after.get(key);
    const stack = nextCard ?? prevCard;
    const from = prevCard?.quantity ?? 0;
    const to = nextCard?.quantity ?? 0;
    if (!stack || from === to) continue;
    changes.push({
      kind: !prevCard ? 'added' : !nextCard ? 'removed' : 'updated',
      cardId: stack.cardId,
      printingId: stack.printingId,
      name: stack.name,
      setCode: stack.setCode,
      collectorNumber: stack.collectorNumber,
      foil: stack.foil,
      sideboard: stack.sideboard,
      quantity: { from, to },
    });
  }

  return changes.sort(
    (a, b) =>
      Number(a.sideboard) - Number(b.sideboard) ||
      a.name.localeCompare(b.name) ||
      a.setCode.localeCompare(b.setCode) ||
      a.collectorNumber.localeCompare(b.collectorNumber, undefined, { numeric: true }) ||
      Number(a.foil) - Number(b.foil),
  );
};

const diffDetails = (prev: DeckSnapshot, next: DeckSnapshot): DeckDetailChange[] => {
  const fields: [DeckDetailChange['field'], string | null, string | null][] = [
    ['name', prev.name, next.name],
    ['description', prev.description, next.description],
    ['format', prev.format, next.format],
    ['commander', prev.commander?.name ?? null, next.commander?.name ?? null],
  ];
  return fields
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => ({ field, from, to }));
};

/**
 * `saved` with the deck details from `current`, for auto-saving detail edits. Other card edits stay
 * unsaved; only the commander's main-board line follows a commander change, as the API adds and
 * removes it together with the commander.
 */
export const snapshotWithDetails = (saved: DeckSnapshot, current: DeckSnapshot): DeckSnapshot => {
  const fromCommander = saved.commander?.printingId ?? null;
  const toCommander = current.commander?.printingId ?? null;
  const isMainLineOf = (printingId: string | null) => (card: DeckSnapshotCard) =>
    !card.sideboard && card.printingId === printingId;

  let cards = saved.cards;
  if (fromCommander !== toCommander) {
    cards = cards.filter((card) => !isMainLineOf(fromCommander)(card));
    if (!cards.some(isMainLineOf(toCommander))) {
      cards = [...cards, ...current.cards.filter(isMainLineOf(toCommander))];
    }
  }

  return {
    name: current.name,
    description: current.description,
    format: current.format,
    commander: current.commander,
    cards,
  };
};

/** Changes from `prev` to `next`; a null `prev` (never saved) treats every card as added. */
export const diffDeck = (prev: DeckSnapshot | null, next: DeckSnapshot): DeckChanges => {
  const baseline: DeckSnapshot = prev ?? {
    name: next.name,
    description: next.description,
    format: next.format,
    commander: next.commander,
    cards: [],
  };
  return {
    cards: diffCards(baseline.cards, next.cards),
    details: diffDetails(baseline, next),
  };
};
