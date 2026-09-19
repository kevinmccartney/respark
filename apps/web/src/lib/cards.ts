import { apiFetchJson } from './api.ts';

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

type GetToken = () => Promise<string | null>;

export const searchCards = (
  getToken: GetToken,
  opts: { q?: string; limit?: number; page?: number },
): Promise<CardSearchPage> => {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return apiFetchJson<CardSearchPage>(`/cards${qs ? `?${qs}` : ''}`, getToken);
};

export const fetchCard = (getToken: GetToken, id: string): Promise<CardDetail> =>
  apiFetchJson<CardDetail>(`/cards/${id}`, getToken);

export type CardNameSuggestion = {
  id: string;
  name: string;
};

export const suggestCardNames = (
  getToken: GetToken,
  q: string,
  limit = 15,
): Promise<CardNameSuggestion[]> => {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiFetchJson<{ suggestions: CardNameSuggestion[] }>(
    `/cards/suggestions?${params}`,
    getToken,
  ).then((body) => body.suggestions);
};
