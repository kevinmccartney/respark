import {
  cardDetailSchema,
  cardSearchPageSchema,
  type CardDetail,
  type CardSearchPage,
  type CardSearchSort,
} from 'schemas/cards';
import type { SortDir } from 'schemas/primitives';
import { apiFetchJson, type GetToken } from '@/core';

export type { CardDetail, CardSearchPage };

export const searchCards = (
  getToken: GetToken,
  opts: {
    scryfall?: string;
    sort?: CardSearchSort;
    dir?: SortDir;
    limit?: number;
    page?: number;
  },
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

export const fetchCard = (
  getToken: GetToken,
  id: string,
  init?: RequestInit,
): Promise<CardDetail> => apiFetchJson(`/cards/${id}`, getToken, cardDetailSchema, init);
