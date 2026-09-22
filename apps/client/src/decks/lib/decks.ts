import {
  addDeckCardBodySchema,
  COLOR_IDENTITY_PIPS,
  createDeckBodySchema,
  DECK_FORMATS,
  deckCardResponseSchema,
  deckDetailSchema,
  deckImportResultSchema,
  deckResponseSchema,
  decksResponseSchema,
  okResponseSchema,
  patchDeckCardBodySchema,
  updateDeckBodySchema,
  type ColorIdentityPip,
  type CreateDeckInput,
  type Deck,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
  type DeckImportResult,
  type DeckImportUnmatched,
  type PatchDeckCardBody,
  type UpdateDeckInput,
} from '@respark/schemas/decks';

import { apiFetchJson, type GetToken } from '@/core';

export { COLOR_IDENTITY_PIPS, DECK_FORMATS };
export type {
  ColorIdentityPip,
  CreateDeckInput,
  Deck,
  DeckCard,
  DeckDetail,
  DeckFormat,
  DeckImportResult,
  DeckImportUnmatched,
};

export const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
};

export const fetchDecks = (getToken: GetToken, init?: RequestInit): Promise<Deck[]> =>
  apiFetchJson('/decks', getToken, decksResponseSchema, init).then((body) => body.decks);

export const createDeck = (getToken: GetToken, input: CreateDeckInput): Promise<Deck> =>
  apiFetchJson('/decks', getToken, deckResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createDeckBodySchema.parse(input)),
  }).then((body) => body.deck);

export const fetchDeck = (
  getToken: GetToken,
  id: string,
  init?: RequestInit,
): Promise<DeckDetail> => apiFetchJson(`/decks/${id}`, getToken, deckDetailSchema, init);

export const updateDeck = (getToken: GetToken, id: string, input: UpdateDeckInput): Promise<Deck> =>
  apiFetchJson(`/decks/${id}`, getToken, deckResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateDeckBodySchema.parse(input)),
  }).then((body) => body.deck);

export const deleteDeck = (getToken: GetToken, id: string): Promise<void> =>
  apiFetchJson(`/decks/${id}`, getToken, okResponseSchema, {
    method: 'DELETE',
  }).then(() => undefined);

export const importDeckList = (
  getToken: GetToken,
  deckId: string,
  text: string,
): Promise<DeckImportResult> =>
  apiFetchJson(`/decks/${deckId}/import`, getToken, deckImportResultSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

const requireDeckCard = (card: DeckCard | null): DeckCard => {
  if (!card) throw new Error('Missing card in response');
  return card;
};

export const addCardToDeck = (
  getToken: GetToken,
  deckId: string,
  cardId: string,
): Promise<DeckCard> =>
  apiFetchJson(`/decks/${deckId}/cards`, getToken, deckCardResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(addDeckCardBodySchema.parse({ cardId })),
  }).then((body) => requireDeckCard(body.card));

const patchDeckCard = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  body: PatchDeckCardBody,
): Promise<DeckCard | null> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, deckCardResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchDeckCardBodySchema.parse(body)),
  }).then((res) => res.card);

export const setDeckCardQuantity = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  quantity: number,
): Promise<DeckCard | null> => patchDeckCard(getToken, deckId, deckCardId, { quantity });

export const setDeckCardPrinting = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  printingId: string,
): Promise<DeckCard> =>
  patchDeckCard(getToken, deckId, deckCardId, { printingId }).then(requireDeckCard);

export const setDeckCardFoil = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  foil: boolean,
): Promise<DeckCard> => patchDeckCard(getToken, deckId, deckCardId, { foil }).then(requireDeckCard);

export const setDeckCardSideboard = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  sideboard: boolean,
): Promise<DeckCard> =>
  patchDeckCard(getToken, deckId, deckCardId, { sideboard }).then(requireDeckCard);

export const removeDeckCard = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
): Promise<void> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, okResponseSchema, {
    method: 'DELETE',
  }).then(() => undefined);

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
