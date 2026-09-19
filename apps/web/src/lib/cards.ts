import { apiFetchJson } from './api.ts'

export type CardSearchResult = {
  id: string
  oracleId: string
  name: string
  manaCost: string | null
  typeLine: string | null
  oracleText: string | null
  imageNormal: string | null
}

export type CardSearchPage = {
  cards: CardSearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type GetToken = () => Promise<string | null>

export function searchCards(
  getToken: GetToken,
  opts: { q?: string; limit?: number; page?: number },
): Promise<CardSearchPage> {
  const params = new URLSearchParams()
  if (opts.q) params.set('q', opts.q)
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page))
  const qs = params.toString()
  return apiFetchJson<CardSearchPage>(`/cards${qs ? `?${qs}` : ''}`, getToken)
}
