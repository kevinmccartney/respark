import { apiFetchJson } from './api.ts'

export const DECK_FORMATS = ['standard', 'commander', 'modern'] as const
export type DeckFormat = (typeof DECK_FORMATS)[number]

export const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
}

export type Deck = {
  id: string
  name: string
  description: string | null
  format: DeckFormat
  updatedAt: string
}

export type DeckCard = {
  id: string
  cardId: string
  printingId: string
  name: string
  manaCost: string | null
  manaValue: string | null
  typeLine: string | null
  foil: boolean
  sideboard: boolean
  quantity: number
  setCode: string
  setName: string
  collectorNumber: string
  imageNormal: string | null
}

export type DeckDetail = {
  deck: Deck
  cards: DeckCard[]
}

export type CreateDeckInput = {
  name: string
  description?: string
  format: DeckFormat
}

type GetToken = () => Promise<string | null>

type DecksResponse = { decks: Deck[] }
type DeckResponse = { deck: Deck }
type DeckCardResponse = { card: DeckCard | null }

export function fetchDecks(getToken: GetToken): Promise<Deck[]> {
  return apiFetchJson<DecksResponse>('/decks', getToken).then((body) => body.decks)
}

export function createDeck(
  getToken: GetToken,
  input: CreateDeckInput,
): Promise<Deck> {
  return apiFetchJson<DeckResponse>('/decks', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((body) => body.deck)
}

export function fetchDeck(getToken: GetToken, id: string): Promise<DeckDetail> {
  return apiFetchJson<DeckDetail>(`/decks/${id}`, getToken)
}

export function updateDeck(
  getToken: GetToken,
  id: string,
  input: {
    name?: string
    description?: string | null
    format?: DeckFormat
  },
): Promise<Deck> {
  return apiFetchJson<DeckResponse>(`/decks/${id}`, getToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).then((body) => body.deck)
}

export function deleteDeck(getToken: GetToken, id: string): Promise<void> {
  return apiFetchJson<{ ok: boolean }>(`/decks/${id}`, getToken, {
    method: 'DELETE',
  }).then(() => undefined)
}

export type DeckImportUnmatched = {
  line: string
  reason: string
}

export type DeckImportResult = {
  imported: number
  unmatched: DeckImportUnmatched[]
  detail: DeckDetail
}

export function importDeckList(
  getToken: GetToken,
  deckId: string,
  text: string,
): Promise<DeckImportResult> {
  return apiFetchJson<DeckImportResult>(`/decks/${deckId}/import`, getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export function addCardToDeck(
  getToken: GetToken,
  deckId: string,
  cardId: string,
): Promise<DeckCard> {
  return apiFetchJson<DeckCardResponse>(`/decks/${deckId}/cards`, getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId }),
  }).then((body) => {
    if (!body.card) throw new Error('Missing card in response')
    return body.card
  })
}

export function setDeckCardQuantity(
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  quantity: number,
): Promise<DeckCard | null> {
  return apiFetchJson<DeckCardResponse>(
    `/decks/${deckId}/cards/${deckCardId}`,
    getToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    },
  ).then((body) => body.card)
}

export function setDeckCardPrinting(
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  printingId: string,
): Promise<DeckCard> {
  return apiFetchJson<DeckCardResponse>(
    `/decks/${deckId}/cards/${deckCardId}`,
    getToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printingId }),
    },
  ).then((body) => {
    if (!body.card) throw new Error('Missing card in response')
    return body.card
  })
}

export function setDeckCardFoil(
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  foil: boolean,
): Promise<DeckCard> {
  return apiFetchJson<DeckCardResponse>(
    `/decks/${deckId}/cards/${deckCardId}`,
    getToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foil }),
    },
  ).then((body) => {
    if (!body.card) throw new Error('Missing card in response')
    return body.card
  })
}

export function setDeckCardSideboard(
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
  sideboard: boolean,
): Promise<DeckCard> {
  return apiFetchJson<DeckCardResponse>(
    `/decks/${deckId}/cards/${deckCardId}`,
    getToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sideboard }),
    },
  ).then((body) => {
    if (!body.card) throw new Error('Missing card in response')
    return body.card
  })
}

export function removeDeckCard(
  getToken: GetToken,
  deckId: string,
  deckCardId: string,
): Promise<void> {
  return apiFetchJson<{ ok: boolean }>(
    `/decks/${deckId}/cards/${deckCardId}`,
    getToken,
    { method: 'DELETE' },
  ).then(() => undefined)
}
