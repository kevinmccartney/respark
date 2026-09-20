import { cardFaceSchema, queryBoolSchema, queryIntSchema, uuidSchema } from './primitives.js';
import { colorIdentitySchema, deckFormatSchema, type DeckFormat } from './decks.js';
import { recommendationDownweightFlagSchema } from './recommendations.js';
import { z } from 'zod';

export const cardSearchResultSchema = z.object({
  id: uuidSchema,
  oracleId: z.string(),
  name: z.string(),
  manaCost: z.string().nullable(),
  manaValue: z.string().nullable(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  colorIdentity: z.array(z.string()).nullable(),
  imageNormal: z.string().nullable(),
  edhrecRank: z.number().int().nullable(),
  edhrecSaltiness: z.number().nullable(),
  isGameChanger: z.boolean().nullable(),
  downweight: recommendationDownweightFlagSchema.nullable(),
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

const FINISH_LABELS: Record<string, string> = {
  nonfoil: 'Nonfoil',
  foil: 'Foil',
  etched: 'Etched',
};

/** Scryfall `etched` is a premium finish; treat it like foil for overlay and deck toggles. */
export const printingHasPremiumFinish = (finishes: readonly string[]): boolean =>
  finishes.includes('foil') || finishes.includes('etched');

/** Empty finishes (pre-sync) are treated as allowing foil. */
export const printingAllowsFoil = (finishes: readonly string[]): boolean =>
  finishes.length === 0 || printingHasPremiumFinish(finishes);

/** Overlay when this printing is etched, or foil-only (not a dual nonfoil/foil printing). */
export const printingHasFoilTreatment = (finishes: readonly string[]): boolean => {
  if (finishes.includes('etched')) return true;
  return finishes.includes('foil') && !finishes.includes('nonfoil');
};

/** Dual nonfoil+foil printings can toggle; etched / foil-only cannot. */
export const printingFoilIsOptional = (finishes: readonly string[]): boolean =>
  printingAllowsFoil(finishes) && !printingHasFoilTreatment(finishes);

/** Persist and display foil for etched/foil-only printings even when the line was stored as non-foil. */
export const resolveDeckLineFoil = (finishes: readonly string[], wantsFoil: boolean): boolean => {
  if (printingHasFoilTreatment(finishes)) return true;
  return wantsFoil && printingAllowsFoil(finishes);
};

export const premiumFinishLabel = (finishes: readonly string[]): 'Etched' | 'Foil' | null => {
  if (finishes.includes('etched')) return 'Etched';
  if (printingHasFoilTreatment(finishes)) return 'Foil';
  return null;
};

export const formatPrintingFinishes = (finishes: readonly string[]): string =>
  finishes.map((finish) => FINISH_LABELS[finish] ?? finish).join(', ');

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
  edhrecRank: z.number().int().nullable(),
  edhrecSaltiness: z.number().nullable(),
  isGameChanger: z.boolean().nullable(),
  downweight: recommendationDownweightFlagSchema.nullable(),
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
export const CARD_SEARCH_EXCLUDE_IDS_MAX = 400;

export const CARD_SEARCH_SORTS = ['name', 'edhrecRank'] as const;
export const cardSearchSortSchema = z.enum(CARD_SEARCH_SORTS);
export type CardSearchSort = z.infer<typeof cardSearchSortSchema>;
export const CARD_SEARCH_DEFAULT_SORT: CardSearchSort = 'name';

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

const uuidListQuerySchema = z.preprocess((value: unknown) => {
  if (value === undefined || value === '' || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}, z.array(uuidSchema).max(CARD_SEARCH_EXCLUDE_IDS_MAX).optional());

export const cardSearchQuerySchema = z.object({
  q: z.string().optional(),
  legalIn: optionalQueryString(deckFormatSchema),
  colorIdentity: colorIdentityQuerySchema,
  commanderEligible: queryBoolSchema,
  typeContains: optionalQueryString(z.string().trim().min(1).max(80)),
  maxManaValue: queryIntSchema(0, 20),
  excludeCardIds: uuidListQuerySchema,
  sort: optionalQueryString(cardSearchSortSchema),
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
