import {
  COLOR_IDENTITY_PIPS,
  type ColorIdentityPip,
  type DeckCard,
  type DeckDetail,
} from '@respark/schemas/decks';

export const colorIdentityFromMainboard = (cards: readonly DeckCard[]): ColorIdentityPip[] => {
  const seen = new Set<ColorIdentityPip>();
  for (const card of cards) {
    if (card.sideboard) continue;
    for (const pip of card.colorIdentity) seen.add(pip);
  }
  return COLOR_IDENTITY_PIPS.filter((pip) => seen.has(pip));
};

export const withDeckCards = (detail: DeckDetail, cards: DeckCard[]): DeckDetail => ({
  deck: {
    ...detail.deck,
    colorIdentity:
      detail.deck.format === 'commander'
        ? detail.deck.colorIdentity
        : colorIdentityFromMainboard(cards),
    updatedAt: new Date().toISOString(),
  },
  cards,
});

export const upsertDeckCard = (
  detail: DeckDetail,
  previousId: string,
  next: DeckCard,
): DeckDetail => {
  const without = detail.cards.filter((card) => card.id !== previousId && card.id !== next.id);
  const cards = [...without, next].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.setCode.localeCompare(b.setCode);
  });
  return withDeckCards(detail, cards);
};
