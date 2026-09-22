import { useAuth } from '@clerk/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { uuidSchema } from '@respark/schemas';

import { fetchCard, fetchCards, fetchCardSuggestions } from '../api/cards';
import { CARD_SUGGESTION_MIN_CHARS } from '../constants';
import type { CardSearchOpts } from '../types';

const CARD_KEYS = {
  all: ['cards'] as const,
  search: (opts: CardSearchOpts) => [...CARD_KEYS.all, 'search', opts] as const,
  detail: (id: string) => [...CARD_KEYS.all, 'detail', id] as const,
  suggestions: (q: string) => [...CARD_KEYS.all, 'suggestions', q] as const,
};

export const useSearchCards = (opts: CardSearchOpts) => {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: CARD_KEYS.search(opts),
    queryFn: ({ signal }) => fetchCards(getToken, opts, { signal }),
    placeholderData: keepPreviousData,
  });
};

export const useCard = (id: string) => {
  const { getToken } = useAuth();
  const validId = uuidSchema.safeParse(id).success;
  return useQuery({
    queryKey: CARD_KEYS.detail(id),
    queryFn: ({ signal }) => fetchCard(getToken, id, { signal }),
    enabled: validId,
  });
};

export const useCardSuggestions = (q: string, enabled = true) => {
  const { getToken } = useAuth();
  const trimmed = q.trim();
  return useQuery({
    queryKey: CARD_KEYS.suggestions(trimmed),
    queryFn: ({ signal }) => fetchCardSuggestions(getToken, trimmed, { signal }),
    enabled: enabled && trimmed.length >= CARD_SUGGESTION_MIN_CHARS,
  });
};
