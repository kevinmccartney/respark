import { useAuth } from '@clerk/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { uuidSchema } from '@respark/schemas/primitives';

import { fetchCard, fetchCardsSearch, fetchCardSuggestions } from '../api/cards';
import { CARD_SUGGESTION_MIN_CHARS } from '../constants';
import type { CardSearchOpts, CardSuggestionOpts } from '../types';

export const cardKeys = {
  all: ['cards'] as const,
  search: (opts: CardSearchOpts) => [...cardKeys.all, 'search', opts] as const,
  detail: (id: string) => [...cardKeys.all, 'detail', id] as const,
  suggestions: (q: string, opts?: CardSuggestionOpts) =>
    [...cardKeys.all, 'suggestions', q, opts ?? {}] as const,
};

export const useSearchCards = (opts: CardSearchOpts) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: cardKeys.search(opts),
    queryFn: ({ signal }) => fetchCardsSearch(getToken, opts, { signal }),
    placeholderData: keepPreviousData,
  });
};

export const useCard = (id: string, enabled = true) => {
  const { getToken } = useAuth();
  const validId = uuidSchema.safeParse(id).success;
  return useQuery({
    queryKey: cardKeys.detail(id),
    queryFn: ({ signal }) => fetchCard(getToken, id, { signal }),
    enabled: enabled && validId,
  });
};

export const useCardSuggestions = (q: string, opts?: CardSuggestionOpts, enabled = true) => {
  const { getToken } = useAuth();
  const trimmed = q.trim();
  return useQuery({
    queryKey: cardKeys.suggestions(trimmed, opts),
    queryFn: ({ signal }) => fetchCardSuggestions(getToken, trimmed, { signal }, opts),
    enabled: enabled && trimmed.length >= CARD_SUGGESTION_MIN_CHARS,
  });
};
