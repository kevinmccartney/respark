import {
  recommendationGoodstuffResponseSchema,
  recommendationGoodstuffsResponseSchema,
  type CreateRecommendationGoodstuffBody,
  type RecommendationGoodstuff,
} from '@respark/schemas';

import { ApiError, apiFetch, apiFetchJson, type GetToken } from '@respark-admin/core/lib';

export const fetchGoodstuffs = async (
  getToken: GetToken,
  init?: RequestInit,
): Promise<RecommendationGoodstuff[]> => {
  const data = await apiFetchJson(
    '/admin/recommendation-goodstuffs',
    getToken,
    recommendationGoodstuffsResponseSchema,
    init,
  );
  return data.goodstuffs;
};

export const createGoodstuff = async (
  getToken: GetToken,
  body: CreateRecommendationGoodstuffBody,
  init?: RequestInit,
): Promise<RecommendationGoodstuff> => {
  const data = await apiFetchJson(
    '/admin/recommendation-goodstuffs',
    getToken,
    recommendationGoodstuffResponseSchema,
    {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return data.goodstuff;
};

export const deleteGoodstuff = async (
  getToken: GetToken,
  cardId: string,
  init?: RequestInit,
): Promise<void> => {
  const response = await apiFetch(`/admin/recommendation-goodstuffs/${cardId}`, getToken, {
    ...init,
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new ApiError('Could not remove goodstuff entry', response.status);
  }
};
