import { queryIntSchema, uuidSchema } from './primitives.js';
import { z } from 'zod';

export const cardSearchResultSchema = z.object({
  id: uuidSchema,
  oracleId: z.string(),
  name: z.string(),
  manaCost: z.string().nullable(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  imageNormal: z.string().nullable(),
});

export type CardSearchResult = z.infer<typeof cardSearchResultSchema>;

export const cardSearchPageSchema = z.object({
  cards: z.array(cardSearchResultSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export type CardSearchPage = z.infer<typeof cardSearchPageSchema>;

export const cardPrintingSummarySchema = z.object({
  id: uuidSchema,
  scryfallId: z.string(),
  collectorNumber: z.string(),
  language: z.string().nullable(),
  rarity: z.string().nullable(),
  artist: z.string().nullable(),
  releasedAt: z.string().nullable(),
  setCode: z.string(),
  setName: z.string(),
  imageNormal: z.string().nullable(),
  imageLarge: z.string().nullable(),
  finishes: z.array(z.string()),
});

export type CardPrintingSummary = z.infer<typeof cardPrintingSummarySchema>;

export const cardDetailSchema = z.object({
  id: uuidSchema,
  oracleId: z.string(),
  name: z.string(),
  manaCost: z.string().nullable(),
  manaValue: z.string().nullable(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  colors: z.array(z.string()).nullable(),
  colorIdentity: z.array(z.string()).nullable(),
  keywords: z.array(z.string()).nullable(),
  layout: z.string().nullable(),
  reserved: z.boolean().nullable(),
  printings: z.array(cardPrintingSummarySchema),
});

export type CardDetail = z.infer<typeof cardDetailSchema>;

export const cardNameSuggestionSchema = z.object({
  id: uuidSchema,
  name: z.string(),
});

export type CardNameSuggestion = z.infer<typeof cardNameSuggestionSchema>;

export const cardSuggestionsResponseSchema = z.object({
  suggestions: z.array(cardNameSuggestionSchema),
});

export type CardSuggestionsResponse = z.infer<typeof cardSuggestionsResponseSchema>;

export const CARD_SEARCH_DEFAULT_LIMIT = 60;
export const CARD_SEARCH_MAX_LIMIT = 100;

export const cardSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: queryIntSchema(1, CARD_SEARCH_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

export const cardSuggestionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: queryIntSchema(1, 30),
});

export type CardSuggestionsQuery = z.infer<typeof cardSuggestionsQuerySchema>;
