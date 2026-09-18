import { apiFetchJson } from './api.ts'

export type Deck = {
  id: string
  name: string
  updatedAt: string
}

type DecksResponse = {
  decks: Deck[]
}

type GetToken = () => Promise<string | null>

export function fetchDecks(getToken: GetToken): Promise<Deck[]> {
  return apiFetchJson<DecksResponse>('/decks', getToken).then((body) => body.decks)
}
