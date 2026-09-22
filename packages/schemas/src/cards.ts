import {
  cardFaceSchema,
  queryBoolSchema,
  queryIntSchema,
  sortDirSchema,
  uuidSchema,
  type SortDir,
} from './primitives.js';
import { deckFormatSchema, type DeckFormat } from './decks.js';
import { recommendationGoodstuffFlagSchema } from './recommendations.js';
import { z } from 'zod';

export const cardLegalitiesSchema = z.record(z.string(), z.string());

export type CardLegalities = z.infer<typeof cardLegalitiesSchema>;

export const cardSearchResultSchema = z.object({
  id: uuidSchema,
  oracleId: z.string(),
  name: z.string(),
  manaCost: z.string().nullable(),
  manaValue: z.string().nullable(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  keywords: z.array(z.string()).nullable(),
  colorIdentity: z.array(z.string()).nullable(),
  legalities: cardLegalitiesSchema.nullable(),
  imageNormal: z.string().nullable(),
  /** Rarity of the representative (best) printing used for the list image. */
  rarity: z.string().nullable(),
  edhrecRank: z.number().int().nullable(),
  edhrecSaltiness: z.number().nullable(),
  isGameChanger: z.boolean().nullable(),
  goodstuff: recommendationGoodstuffFlagSchema.nullable(),
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
  goodstuff: recommendationGoodstuffFlagSchema.nullable(),
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

export const CARD_TYPE_SUGGESTIONS_DEFAULT_LIMIT = 15;
export const CARD_TYPE_SUGGESTIONS_MAX_LIMIT = 30;

export const cardTypeSuggestionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: queryIntSchema(1, CARD_TYPE_SUGGESTIONS_MAX_LIMIT),
});

export type CardTypeSuggestionsQuery = z.infer<typeof cardTypeSuggestionsQuerySchema>;

export const cardTypeSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string()),
});

export type CardTypeSuggestionsResponse = z.infer<typeof cardTypeSuggestionsResponseSchema>;

export const CARD_SEARCH_DEFAULT_LIMIT = 60;
export const CARD_SEARCH_MAX_LIMIT = 100;
export const CARD_SEARCH_EXCLUDE_IDS_MAX = 400;

/** Max length for a Scryfall-syntax query string. */
export const CARD_SEARCH_SCRYFALL_QUERY_MAX = 500;

export const CARD_SEARCH_SORTS = ['name', 'edhrecRank', 'manaValue'] as const;
export const cardSearchSortSchema = z.enum(CARD_SEARCH_SORTS);
export type CardSearchSort = z.infer<typeof cardSearchSortSchema>;
export const CARD_SEARCH_DEFAULT_SORT: CardSearchSort = 'name';

/** Default direction when `dir` is omitted. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defaultCardSortDir = (_sort: CardSearchSort): SortDir => 'asc';

/** Admin/browse color filter tokens — `C` means colorless (empty identity). */
export const CARD_SEARCH_COLOR_FILTERS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
export const cardSearchColorFilterSchema = z.enum(CARD_SEARCH_COLOR_FILTERS);
export type CardSearchColorFilter = z.infer<typeof cardSearchColorFilterSchema>;

/** Printing rarities used for card search filters (Scryfall vocabulary). */
export const CARD_SEARCH_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'mythic',
  'special',
  'bonus',
] as const;
export const cardSearchRaritySchema = z.enum(CARD_SEARCH_RARITIES);
export type CardSearchRarity = z.infer<typeof cardSearchRaritySchema>;

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
}, z.array(cardSearchColorFilterSchema).optional());

const legalInQuerySchema = z.preprocess((value: unknown) => {
  if (value === undefined || value === '' || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}, z.array(deckFormatSchema).min(1).optional());

/** Comma-separated type-line substrings; all must match (AND). */
export const CARD_SEARCH_TYPE_CONTAINS_MAX = 8;

const typeContainsQuerySchema = z.preprocess(
  (value: unknown) => {
    if (value === undefined || value === '' || value === null) return undefined;
    if (Array.isArray(value)) {
      return value.map((part) => String(part).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return value;
  },
  z.array(z.string().min(1).max(80)).min(1).max(CARD_SEARCH_TYPE_CONTAINS_MAX).optional(),
);

const rarityQuerySchema = z.preprocess((value: unknown) => {
  if (value === undefined || value === '' || value === null) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return value;
}, z.array(cardSearchRaritySchema).min(1).optional());

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
  /**
   * Legacy keyword ILIKE across name/type/oracle/…. Prefer `scryfall` (bare name or field
   * clauses). Still accepted for old bookmarks and chat until callers finish migrating.
   */
  q: z.string().optional(),
  /** Primary match language: Scryfall syntax parsed locally and compiled to SQL. */
  scryfall: optionalQueryString(z.string().trim().min(1).max(CARD_SEARCH_SCRYFALL_QUERY_MAX)),
  /** Legacy — prefer `f:` / `format:` in `scryfall`. Still used by chat deck inject. */
  legalIn: legalInQuerySchema,
  /** Legacy — prefer `id:` / `identity:` in `scryfall`. Still used by chat deck inject. */
  colorIdentity: colorIdentityQuerySchema,
  /** When false, empty identity is excluded from color filters. Only applies with `colorIdentity`. */
  includeColorless: queryBoolSchema,
  /** Leadership-skills filter for commander pickers (not Scryfall syntax). */
  commanderEligible: queryBoolSchema,
  /** Legacy — prefer `t:` / `type:` in `scryfall`. */
  typeContains: typeContainsQuerySchema,
  /** Legacy — prefer `r:` / `rarity:` in `scryfall`. */
  rarity: rarityQuerySchema,
  /** Legacy — prefer `mv<=N` in `scryfall`. */
  maxManaValue: queryIntSchema(0, 20),
  /** Chat / tooling: exclude known card ids from results. */
  excludeCardIds: uuidListQuerySchema,
  sort: optionalQueryString(cardSearchSortSchema),
  dir: optionalQueryString(sortDirSchema),
  limit: queryIntSchema(1, CARD_SEARCH_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

export const cardSuggestionsQuerySchema = z.object({
  q: z.string().optional(),
  legalIn: legalInQuerySchema,
  colorIdentity: colorIdentityQuerySchema,
  commanderEligible: queryBoolSchema,
  limit: queryIntSchema(1, 30),
});

export type CardSuggestionsQuery = z.infer<typeof cardSuggestionsQuerySchema>;
