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
  type ColorIdentityPip,
  type CreateDeckInput,
  type Deck,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
  type DeckImportResult,
  type DeckImportUnmatched,
  type UpdateDeckInput,
} from 'schemas/decks';
import { apiFetchJson } from './api.ts';

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

type GetToken = () => Promise<string | null>;

export const fetchDecks = (getToken: GetToken): Promise<Deck[]> =>
  apiFetchJson('/decks', getToken, decksResponseSchema).then((body) => body.decks);

export const createDeck = (getToken: GetToken, input: CreateDeckInput): Promise<Deck> =>
  apiFetchJson('/decks', getToken, deckResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createDeckBodySchema.parse(input)),
  }).then((body) => body.deck);

export const fetchDeck = (getToken: GetToken, id: string): Promise<DeckDetail> =>
  apiFetchJson(`/decks/${id}`, getToken, deckDetailSchema);

export const updateDeck = (getToken: GetToken, id: string, input: UpdateDeckInput): Promise<Deck> =>
  apiFetchJson(`/decks/${id}`, getToken, deckResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
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

export const addCardToDeck = (
  getToken: GetToken,
  deckId: string,
  cardId: string,
): Promise<DeckCard> =>
  apiFetchJson(`/decks/${deckId}/cards`, getToken, deckCardResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(addDeckCardBodySchema.parse({ cardId })),
  }).then((body) => {
    if (!body.card) throw new Error('Missing card in response');
    return body.card;
  });

export const setDeckCardQuantity = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  quantity: number,
): Promise<DeckCard | null> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, deckCardResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  }).then((body) => body.card);

export const setDeckCardPrinting = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  printingId: string,
): Promise<DeckCard> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, deckCardResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printingId }),
  }).then((body) => {
    if (!body.card) throw new Error('Missing card in response');
    return body.card;
  });

export const setDeckCardFoil = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  foil: boolean,
): Promise<DeckCard> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, deckCardResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ foil }),
  }).then((body) => {
    if (!body.card) throw new Error('Missing card in response');
    return body.card;
  });

export const setDeckCardSideboard = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  sideboard: boolean,
): Promise<DeckCard> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, deckCardResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sideboard }),
  }).then((body) => {
    if (!body.card) throw new Error('Missing card in response');
    return body.card;
  });

export const removeDeckCard = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
): Promise<void> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, okResponseSchema, {
    method: 'DELETE',
  }).then(() => undefined);
