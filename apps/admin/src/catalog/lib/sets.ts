import {
  setDetailSchema,
  setSearchPageSchema,
  setTypeSuggestionsResponseSchema,
  type SetDetail,
  type SetPrintingSort,
  type SetSearchPage,
  type SetSearchSort,
} from 'schemas/sets';
import type { SortDir } from 'schemas/primitives';
import { apiFetchJson, type GetToken } from '@/core';

export type { SetDetail, SetSearchPage };

export const searchSets = (
  getToken: GetToken,
  opts: {
    q?: string;
    setType?: string | string[];
    digital?: boolean;
    sort?: SetSearchSort;
    dir?: SortDir;
    limit?: number;
    page?: number;
  },
  init?: RequestInit,
): Promise<SetSearchPage> => {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.setType) {
    const types = Array.isArray(opts.setType) ? opts.setType : [opts.setType];
    const cleaned = types.map((token) => token.trim()).filter(Boolean);
    if (cleaned.length > 0) params.set('setType', cleaned.join(','));
  }
  if (opts.digital !== undefined) params.set('digital', opts.digital ? 'true' : 'false');
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.dir) params.set('dir', opts.dir);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return apiFetchJson(`/sets${qs ? `?${qs}` : ''}`, getToken, setSearchPageSchema, init);
};

export const suggestSetTypes = (
  getToken: GetToken,
  q: string,
  init?: RequestInit,
): Promise<string[]> => {
  const params = new URLSearchParams({ limit: '30' });
  if (q) params.set('q', q);
  return apiFetchJson(
    `/sets/type-suggestions?${params}`,
    getToken,
    setTypeSuggestionsResponseSchema,
    init,
  ).then((body) => body.suggestions);
};

export const fetchSet = (
  getToken: GetToken,
  id: string,
  opts?: {
    sort?: SetPrintingSort;
    dir?: SortDir;
    limit?: number;
    page?: number;
  },
  init?: RequestInit,
): Promise<SetDetail> => {
  const params = new URLSearchParams();
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.dir) params.set('dir', opts.dir);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.page !== undefined && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return apiFetchJson(`/sets/${id}${qs ? `?${qs}` : ''}`, getToken, setDetailSchema, init);
};
