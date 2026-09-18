import { apiFetchJson } from './api.ts'

export type Deck = {
  id: string
  name: string
  updatedAt: string
}

type DecksResponse = {
  decks: Deck[]
}

type DeckResponse = {
  deck: Deck
}

type GetToken = () => Promise<string | null>

export function fetchDecks(getToken: GetToken): Promise<Deck[]> {
  return apiFetchJson<DecksResponse>('/decks', getToken).then((body) => body.decks)
}

export function createDeck(getToken: GetToken, name: string): Promise<Deck> {
  return apiFetchJson<DeckResponse>('/decks', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then((body) => body.deck)
}
