import {
  setDetailSchema,
  setSearchPageSchema,
  setTypeSuggestionsResponseSchema,
  type SetSearchPage,
} from '@respark/schemas';

import { apiFetchJson, type GetToken } from '@respark-admin/core/lib';

import type { SetDetailOpts, SetSearchOpts } from '../types';

export const fetchSets = (
  getToken: GetToken,
  opts: SetSearchOpts,
  init?: RequestInit,
): Promise<SetSearchPage> => {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.setType) {
    const types = Array.isArray(opts.setType) ? opts.setType : [opts.setType];
    const cleaned = types.map((token) => token.trim()).filter(Boolean);
    if (cleaned.length > 0) params.set('setType', cleaned.join(','));
  }
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.dir) params.set('dir', opts.dir);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));

  const qs = params.toString();

  return apiFetchJson(`/sets${qs ? `?${qs}` : ''}`, getToken, setSearchPageSchema, init);
};

export const fetchSet = (
  getToken: GetToken,
  id: string,
  opts: SetDetailOpts = {},
  init?: RequestInit,
) => {
  const params = new URLSearchParams();
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.dir) params.set('dir', opts.dir);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return apiFetchJson(`/sets/${id}${qs ? `?${qs}` : ''}`, getToken, setDetailSchema, init);
};

export const fetchSetTypeSuggestions = async (
  getToken: GetToken,
  q: string,
  init?: RequestInit,
): Promise<string[]> => {
  const params = new URLSearchParams({ limit: '30' });
  if (q) params.set('q', q);
  const body = await apiFetchJson(
    `/sets/type-suggestions?${params}`,
    getToken,
    setTypeSuggestionsResponseSchema,
    init,
  );
  return body.suggestions;
};
