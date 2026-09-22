import type { CompactDeck } from '@respark/schemas/chat';
import type { DeckCard, DeckDetail } from '@respark/schemas/decks';

import { GET_DECK_KEYWORD_COUNT_CAP, GET_DECK_LINE_CAP } from '../chat.constants';

const PRIMARY_TYPES = [
  'Creature',
  'Instant',
  'Sorcery',
  'Artifact',
  'Enchantment',
  'Planeswalker',
  'Battle',
  'Land',
  'Kindred',
] as const;

export const toCompactDeck = (detail: DeckDetail): CompactDeck => {
  const lines = detail.cards.map((card) => ({
    cardId: card.cardId,
    name: card.name,
    typeLine: card.typeLine,
    manaValue: card.manaValue,
    colorIdentity: card.colorIdentity,
    keywords: card.keywords,
    quantity: card.quantity,
    sideboard: card.sideboard,
  }));
  const truncated = lines.length > GET_DECK_LINE_CAP;
  const commanderLine = detail.deck.commanderPrintingId
    ? detail.cards.find((card) => card.printingId === detail.deck.commanderPrintingId)
    : undefined;

  return {
    id: detail.deck.id,
    name: detail.deck.name,
    description: detail.deck.description,
    format: detail.deck.format,
    colorIdentity: detail.deck.colorIdentity,
    commander:
      commanderLine && detail.deck.commanderPrintingId
        ? {
            printingId: detail.deck.commanderPrintingId,
            cardId: commanderLine.cardId,
            name: commanderLine.name,
            typeLine: commanderLine.typeLine,
            oracleText: commanderLine.oracleText,
            keywords: commanderLine.keywords,
          }
        : null,
    cardCount: detail.cards.reduce((sum, card) => sum + card.quantity, 0),
    stats: deckStats(detail.cards),
    lines: truncated ? lines.slice(0, GET_DECK_LINE_CAP) : lines,
    truncated,
  };
};

export const deckStats = (cards: DeckCard[]): CompactDeck['stats'] => {
  const typeCounts: Record<string, number> = {};
  const manaCurve: Record<string, number> = {};
  for (const card of cards) {
    if (card.sideboard) continue;
    const type = primaryType(card.typeLine);
    typeCounts[type] = (typeCounts[type] ?? 0) + card.quantity;
    const bucket = manaBucket(card.manaValue);
    manaCurve[bucket] = (manaCurve[bucket] ?? 0) + card.quantity;
  }
  return { typeCounts, manaCurve, keywordCounts: keywordCounts(cards) };
};

export const keywordCounts = (
  cards: DeckCard[],
  cap = GET_DECK_KEYWORD_COUNT_CAP,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const card of cards) {
    if (card.sideboard) continue;
    for (const keyword of card.keywords ?? []) {
      const key = keyword.trim();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + card.quantity;
    }
  }
  return Object.fromEntries(
    Object.entries(counts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, cap),
  );
};

export const primaryType = (typeLine: string | null): string => {
  if (!typeLine) return 'Other';
  const face = typeLine.split('//')[0]?.trim() ?? typeLine;
  const dash = face.indexOf('—');
  const beforeDash = (dash >= 0 ? face.slice(0, dash) : face).trim();
  for (const type of PRIMARY_TYPES) {
    if (beforeDash.includes(type)) return type;
  }
  return 'Other';
};

export const manaBucket = (manaValue: string | null): string => {
  if (manaValue === null || manaValue.trim() === '') return 'unknown';
  const n = Number(manaValue);
  if (!Number.isFinite(n)) return 'unknown';
  const f = Math.floor(n);
  return f >= 7 ? '7+' : String(Math.max(0, f));
};
