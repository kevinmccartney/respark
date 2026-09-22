import { useAuth } from '@clerk/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { uuidSchema } from '@respark/schemas';

import { fetchSet, fetchSets, fetchSetTypeSuggestions } from '../api/sets';
import type { SetDetailOpts, SetSearchOpts } from '../types';

const SET_KEYS = {
  all: ['sets'] as const,
  search: (opts: SetSearchOpts) => [...SET_KEYS.all, 'search', opts] as const,
  detail: (id: string, opts: SetDetailOpts) => [...SET_KEYS.all, 'detail', id, opts] as const,
  typeSuggestions: (q: string) => [...SET_KEYS.all, 'typeSuggestions', q] as const,
};

export const useSearchSets = (opts: SetSearchOpts) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: SET_KEYS.search(opts),
    queryFn: ({ signal }) => fetchSets(getToken, opts, { signal }),
    placeholderData: keepPreviousData,
  });
};

export const useSet = (id: string, opts: SetDetailOpts = {}) => {
  const { getToken } = useAuth();
  const validId = uuidSchema.safeParse(id).success;
  return useQuery({
    queryKey: SET_KEYS.detail(id, opts),
    queryFn: ({ signal }) => fetchSet(getToken, id, opts, { signal }),
    enabled: validId,
    placeholderData: keepPreviousData,
  });
};

export const useSetTypeSuggestions = (q: string, enabled = true) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: SET_KEYS.typeSuggestions(q),
    queryFn: ({ signal }) => fetchSetTypeSuggestions(getToken, q, { signal }),
    enabled,
  });
};
