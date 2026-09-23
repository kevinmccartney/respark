import { useAuth } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateRecommendationGoodstuffBody,
  PatchRecommendationGoodstuffBody,
} from '@respark/schemas';

import {
  createGoodstuff,
  deleteGoodstuff,
  fetchGoodstuffs,
  patchGoodstuff,
} from '../api/goodstuffs';

export const goodstuffKeys = {
  all: ['goodstuffs'] as const,
  list: () => [...goodstuffKeys.all, 'list'] as const,
};

export const useGoodstuffs = () => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: goodstuffKeys.list(),
    queryFn: ({ signal }) => fetchGoodstuffs(getToken, { signal }),
  });
};

export const useCreateGoodstuff = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRecommendationGoodstuffBody) => createGoodstuff(getToken, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goodstuffKeys.all });
    },
  });
};

export const usePatchGoodstuff = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: PatchRecommendationGoodstuffBody }) =>
      patchGoodstuff(getToken, cardId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goodstuffKeys.all });
    },
  });
};

export const useDeleteGoodstuff = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => deleteGoodstuff(getToken, cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goodstuffKeys.all });
    },
  });
};
