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
