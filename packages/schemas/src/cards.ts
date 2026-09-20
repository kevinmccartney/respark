import { cardFaceSchema, queryBoolSchema, queryIntSchema, uuidSchema } from './primitives.js';
import { colorIdentitySchema, deckFormatSchema, type DeckFormat } from './decks.js';
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
  faces: z.array(cardFaceSchema),
});

export type CardPrintingSummary = z.infer<typeof cardPrintingSummarySchema>;

export const cardLegalitiesSchema = z.record(z.string(), z.string());

export type CardLegalities = z.infer<typeof cardLegalitiesSchema>;

/** MTGJSON leadershipSkills. Extra provider keys are stripped at the wire. */
export const leadershipSkillsSchema = z.object({
  brawl: z.boolean(),
  commander: z.boolean(),
  oathbreaker: z.boolean(),
});

export type LeadershipSkills = z.infer<typeof leadershipSkillsSchema>;

export const isLeadershipCommander = (skills: LeadershipSkills | null | undefined): boolean =>
  skills?.commander === true;

/** Missing legalities (pre-sync) are treated as allowed; a known non-legal status is not. */
export const isLegalInFormat = (
  legalities: CardLegalities | null | undefined,
  format: DeckFormat,
): boolean => {
  if (!legalities) return true;
  return legalities[format] === 'legal';
};

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
  legalities: cardLegalitiesSchema.nullable(),
  leadershipSkills: leadershipSkillsSchema.nullable(),
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

const optionalQueryString = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value: unknown) => {
    if (value === undefined || value === '' || value === null) return undefined;
    return value;
  }, schema.optional());

const colorIdentityQuerySchema = z.preprocess((value: unknown) => {
  if (value === undefined || value === '' || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}, colorIdentitySchema.optional());

export const cardSearchQuerySchema = z.object({
  q: z.string().optional(),
  legalIn: optionalQueryString(deckFormatSchema),
  colorIdentity: colorIdentityQuerySchema,
  commanderEligible: queryBoolSchema,
  limit: queryIntSchema(1, CARD_SEARCH_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

export const cardSuggestionsQuerySchema = z.object({
  q: z.string().optional(),
  legalIn: optionalQueryString(deckFormatSchema),
  colorIdentity: colorIdentityQuerySchema,
  commanderEligible: queryBoolSchema,
  limit: queryIntSchema(1, 30),
});

export type CardSuggestionsQuery = z.infer<typeof cardSuggestionsQuerySchema>;
