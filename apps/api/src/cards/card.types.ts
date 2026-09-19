export type CardSearchResult = {
  id: string;
  oracleId: string;
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  imageNormal: string | null;
};

export type CardSearchPage = {
  cards: CardSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CardPrintingSummary = {
  id: string;
  scryfallId: string;
  collectorNumber: string;
  language: string | null;
  rarity: string | null;
  artist: string | null;
  releasedAt: string | null;
  setCode: string;
  setName: string;
  imageNormal: string | null;
  imageLarge: string | null;
};

export type CardDetail = {
  id: string;
  oracleId: string;
  name: string;
  manaCost: string | null;
  manaValue: string | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[] | null;
  colorIdentity: string[] | null;
  keywords: string[] | null;
  layout: string | null;
  reserved: boolean | null;
  printings: CardPrintingSummary[];
};

/** Name-only suggestion for deck builder autocomplete. */
export type CardNameSuggestion = {
  id: string;
  name: string;
};
