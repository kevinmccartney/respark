import {
  recommendationGoodstuffResponseSchema,
  recommendationGoodstuffsResponseSchema,
  type CreateRecommendationGoodstuffBody,
  type RecommendationGoodstuff,
} from 'schemas/recommendations';
import { cardSuggestionsResponseSchema, type CardNameSuggestion } from 'schemas/cards';
import { ApiError, apiFetch, apiFetchJson, type GetToken } from '@/core';

export const fetchGoodstuffs = async (getToken: GetToken): Promise<RecommendationGoodstuff[]> => {
  const data = await apiFetchJson(
    '/admin/recommendation-goodstuffs',
    getToken,
    recommendationGoodstuffsResponseSchema,
  );
  return data.goodstuffs;
};

export const createGoodstuff = async (
  getToken: GetToken,
  body: CreateRecommendationGoodstuffBody,
): Promise<RecommendationGoodstuff> => {
  const data = await apiFetchJson(
    '/admin/recommendation-goodstuffs',
    getToken,
    recommendationGoodstuffResponseSchema,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return data.goodstuff;
};

export const deleteGoodstuff = async (getToken: GetToken, cardId: string): Promise<void> => {
  const response = await apiFetch(`/admin/recommendation-goodstuffs/${cardId}`, getToken, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new ApiError('Could not remove goodstuff entry', response.status);
  }
};

export const suggestCards = async (
  getToken: GetToken,
  q: string,
): Promise<CardNameSuggestion[]> => {
  const params = new URLSearchParams({ q, limit: '10' });
  const data = await apiFetchJson(
    `/cards/suggestions?${params}`,
    getToken,
    cardSuggestionsResponseSchema,
  );
  return data.suggestions;
};
