import {
  cardDetailSchema,
  cardSearchPageSchema,
  cardSuggestionsResponseSchema,
  type CardDetail,
  type CardNameSuggestion,
  type CardPrintingSummary,
  type CardSearchPage,
  type CardSearchResult,
  type CardSearchSort,
} from '@respark/schemas/cards';
import type { ColorIdentityPip, DeckFormat } from '@respark/schemas/decks';

import { apiFetchJson, type GetToken } from '@/core';

export type {
  CardDetail,
  CardNameSuggestion,
  CardPrintingSummary,
  CardSearchPage,
  CardSearchResult,
};

export const searchCards = (
  getToken: GetToken,
  opts: {
    scryfall?: string;
    legalIn?: DeckFormat;
    colorIdentity?: ColorIdentityPip[];
    commanderEligible?: boolean;
    sort?: CardSearchSort;
    limit?: number;
    page?: number;
  },
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

export const suggestCardNames = (
  getToken: GetToken,
  q: string,
  init?: RequestInit,
  opts?: {
    limit?: number;
    legalIn?: DeckFormat;
    colorIdentity?: ColorIdentityPip[];
    commanderEligible?: boolean;
  },
): Promise<CardNameSuggestion[]> => {
  const params = new URLSearchParams({ q, limit: String(opts?.limit ?? 15) });
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
