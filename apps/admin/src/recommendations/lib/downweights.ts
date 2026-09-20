import {
  recommendationDownweightResponseSchema,
  recommendationDownweightsResponseSchema,
  type CreateRecommendationDownweightBody,
  type RecommendationDownweight,
} from 'schemas/recommendations';
import { cardSuggestionsResponseSchema, type CardNameSuggestion } from 'schemas/cards';
import { ApiError, apiFetch, apiFetchJson, type GetToken } from '@/core';

export const fetchDownweights = async (getToken: GetToken): Promise<RecommendationDownweight[]> => {
  const data = await apiFetchJson(
    '/admin/recommendation-downweights',
    getToken,
    recommendationDownweightsResponseSchema,
  );
  return data.downweights;
};

export const createDownweight = async (
  getToken: GetToken,
  body: CreateRecommendationDownweightBody,
): Promise<RecommendationDownweight> => {
  const data = await apiFetchJson(
    '/admin/recommendation-downweights',
    getToken,
    recommendationDownweightResponseSchema,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return data.downweight;
};

export const deleteDownweight = async (getToken: GetToken, cardId: string): Promise<void> => {
  const response = await apiFetch(`/admin/recommendation-downweights/${cardId}`, getToken, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new ApiError('Could not remove downweight', response.status);
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
