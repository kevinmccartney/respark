import {
  cardDetailSchema,
  cardSearchPageSchema,
  cardTypeSuggestionsResponseSchema,
  type CardDetail,
  type CardSearchColorFilter,
  type CardSearchPage,
  type CardSearchRarity,
  type CardSearchSort,
} from 'schemas/cards';
import type { DeckFormat } from 'schemas/decks';
import type { SortDir } from 'schemas/primitives';
import { apiFetchJson, type GetToken } from '@/core';

export type { CardDetail, CardSearchPage };

export const searchCards = (
  getToken: GetToken,
  opts: {
    q?: string;
    legalIn?: DeckFormat | DeckFormat[];
    colorIdentity?: CardSearchColorFilter[];
    includeColorless?: boolean;
    typeContains?: string | string[];
    rarity?: CardSearchRarity[];
    sort?: CardSearchSort;
    dir?: SortDir;
    limit?: number;
    page?: number;
  },
  init?: RequestInit,
): Promise<CardSearchPage> => {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.legalIn) {
    const formats = Array.isArray(opts.legalIn) ? opts.legalIn : [opts.legalIn];
    if (formats.length > 0) params.set('legalIn', formats.join(','));
  }
  if (opts.colorIdentity?.length) params.set('colorIdentity', opts.colorIdentity.join(','));
  if (opts.includeColorless === false) params.set('includeColorless', 'false');
  if (opts.includeColorless === true) params.set('includeColorless', 'true');
  if (opts.typeContains) {
    const tokens = Array.isArray(opts.typeContains) ? opts.typeContains : [opts.typeContains];
    const cleaned = tokens.map((token) => token.trim()).filter(Boolean);
    if (cleaned.length > 0) params.set('typeContains', cleaned.join(','));
  }
  if (opts.rarity?.length) params.set('rarity', opts.rarity.join(','));
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.dir) params.set('dir', opts.dir);
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

export const suggestCardTypes = (
  getToken: GetToken,
  q: string,
  init?: RequestInit,
): Promise<string[]> => {
  const params = new URLSearchParams({ q, limit: '15' });
  return apiFetchJson(
    `/cards/type-suggestions?${params}`,
    getToken,
    cardTypeSuggestionsResponseSchema,
    init,
  ).then((body) => body.suggestions);
};
