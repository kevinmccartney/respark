import {
  cardDetailSchema,
  cardSearchPageSchema,
  cardSuggestionsResponseSchema,
  type CardDetail,
  type CardNameSuggestion,
  type CardPrintingSummary,
  type CardSearchPage,
  type CardSearchResult,
} from '@respark/schemas/cards';

import { apiFetchJson, type GetToken } from '@respark-client/core';

import { CARD_SUGGESTION_LIMIT } from '../constants';
import type { CardSearchOpts, CardSuggestionOpts } from '../types';

export type {
  CardDetail,
  CardNameSuggestion,
  CardPrintingSummary,
  CardSearchPage,
  CardSearchResult,
};

export const fetchCardsSearch = (
  getToken: GetToken,
  opts: CardSearchOpts,
  init?: RequestInit,
): Promise<CardSearchPage> => {
  const params = new URLSearchParams();
  if (opts.scryfall) params.set('scryfall', opts.scryfall);
  if (opts.legalIn) params.set('legalIn', opts.legalIn);
  if (opts.colorIdentity) params.set('colorIdentity', opts.colorIdentity.join(','));
  if (opts.commanderEligible) params.set('commanderEligible', 'true');
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return apiFetchJson(`/cards${qs ? `?${qs}` : ''}`, getToken, cardSearchPageSchema, init);
};

export const fetchCard = (
  getToken: GetToken,
  id: string,
  init?: RequestInit,
): Promise<CardDetail> => apiFetchJson(`/cards/${id}`, getToken, cardDetailSchema, init);

export const fetchCardSuggestions = (
  getToken: GetToken,
  q: string,
  init?: RequestInit,
  opts?: CardSuggestionOpts,
): Promise<CardNameSuggestion[]> => {
  const params = new URLSearchParams({ q, limit: String(opts?.limit ?? CARD_SUGGESTION_LIMIT) });
  if (opts?.legalIn) params.set('legalIn', opts.legalIn);
  if (opts?.colorIdentity) params.set('colorIdentity', opts.colorIdentity.join(','));
  if (opts?.commanderEligible) params.set('commanderEligible', 'true');
  return apiFetchJson(
    `/cards/suggestions?${params}`,
    getToken,
    cardSuggestionsResponseSchema,
    init,
  ).then((body) => body.suggestions);
};
