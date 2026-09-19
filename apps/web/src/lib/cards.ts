import {
  cardDetailSchema,
  cardSearchPageSchema,
  cardSuggestionsResponseSchema,
  type CardDetail,
  type CardNameSuggestion,
  type CardPrintingSummary,
  type CardSearchPage,
  type CardSearchResult,
} from 'schemas/cards';
import { apiFetchJson } from './api.ts';

export type {
  CardDetail,
  CardNameSuggestion,
  CardPrintingSummary,
  CardSearchPage,
  CardSearchResult,
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
  return apiFetchJson(`/cards${qs ? `?${qs}` : ''}`, getToken, cardSearchPageSchema);
};

export const fetchCard = (getToken: GetToken, id: string): Promise<CardDetail> =>
  apiFetchJson(`/cards/${id}`, getToken, cardDetailSchema);

export const suggestCardNames = (
  getToken: GetToken,
  q: string,
  limit = 15,
): Promise<CardNameSuggestion[]> => {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return apiFetchJson(`/cards/suggestions?${params}`, getToken, cardSuggestionsResponseSchema).then(
    (body) => body.suggestions,
  );
};
