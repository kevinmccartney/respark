import {
  addDeckCardBodySchema,
  createDeckBodySchema,
  deckCardResponseSchema,
  deckDetailSchema,
  deckImportResultSchema,
  deckResponseSchema,
  decksResponseSchema,
  okResponseSchema,
  patchDeckCardBodySchema,
  updateDeckBodySchema,
  type CreateDeckInput,
  type Deck,
  type DeckCard,
  type DeckDetail,
  type DeckImportResult,
  type PatchDeckCardBody,
  type UpdateDeckInput,
} from '@respark/schemas/decks';

import { apiFetchJson, type GetToken } from '@respark-client/core';

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

export const patchDeckCard = (
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

export const removeDeckCard = (
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
): Promise<void> =>
  apiFetchJson(`/decks/${deckId}/cards/${deckCardId}`, getToken, okResponseSchema, {
    method: 'DELETE',
  }).then(() => undefined);
