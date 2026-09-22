import {
  cardDetailSchema,
  cardSearchPageSchema,
  cardSuggestionsResponseSchema,
  type CardNameSuggestion,
  type CardSearchPage,
} from '@respark/schemas';

import { apiFetchJson, type GetToken } from '@respark-admin/core/lib';

import { CARD_SUGGESTION_LIMIT } from '../constants';
import type { CardSearchOpts } from '../types';

export const fetchCards = (
  getToken: GetToken,
  opts: CardSearchOpts,
  init?: RequestInit,
): Promise<CardSearchPage> => {
  const params = new URLSearchParams();
  if (opts.scryfall) params.set('scryfall', opts.scryfall);
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.dir) params.set('dir', opts.dir);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();

  return apiFetchJson(`/cards${qs ? `?${qs}` : ''}`, getToken, cardSearchPageSchema, init);
};

export const fetchCard = (getToken: GetToken, id: string, init?: RequestInit) =>
  apiFetchJson(`/cards/${id}`, getToken, cardDetailSchema, init);

export const fetchCardSuggestions = async (
  getToken: GetToken,
  q: string,
  init?: RequestInit,
): Promise<CardNameSuggestion[]> => {
  const params = new URLSearchParams({ q, limit: String(CARD_SUGGESTION_LIMIT) });
  const data = await apiFetchJson(
    `/cards/suggestions?${params}`,
    getToken,
    cardSuggestionsResponseSchema,
    init,
  );
  return data.suggestions;
};
