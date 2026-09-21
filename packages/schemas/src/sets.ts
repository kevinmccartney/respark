import {
  queryBoolSchema,
  queryIntSchema,
  sortDirSchema,
  uuidSchema,
  type SortDir,
} from './primitives.js';
import { z } from 'zod';

export const SET_SEARCH_DEFAULT_LIMIT = 50;
export const SET_SEARCH_MAX_LIMIT = 100;
export const SET_PRINTINGS_DEFAULT_LIMIT = 50;
export const SET_PRINTINGS_MAX_LIMIT = 100;

export const SET_SEARCH_SORTS = [
  'name',
  'code',
  'releasedAt',
  'setType',
  'cardCount',
  'digital',
] as const;
export const setSearchSortSchema = z.enum(SET_SEARCH_SORTS);
export type SetSearchSort = z.infer<typeof setSearchSortSchema>;
export const SET_SEARCH_DEFAULT_SORT: SetSearchSort = 'releasedAt';

/** Default direction when `dir` is omitted — newest-first for release date. */
export const defaultSetSortDir = (sort: SetSearchSort): SortDir =>
  sort === 'releasedAt' || sort === 'cardCount' ? 'desc' : 'asc';

export const SET_PRINTING_SORTS = ['collectorNumber', 'name', 'rarity'] as const;
export const setPrintingSortSchema = z.enum(SET_PRINTING_SORTS);
export type SetPrintingSort = z.infer<typeof setPrintingSortSchema>;
export const SET_PRINTING_DEFAULT_SORT: SetPrintingSort = 'collectorNumber';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defaultSetPrintingSortDir = (_sort: SetPrintingSort): SortDir => 'asc';

export const SET_TYPE_SUGGESTIONS_DEFAULT_LIMIT = 30;
export const SET_TYPE_SUGGESTIONS_MAX_LIMIT = 40;
/** Max set types selectable in one search (catalog has ~24 distinct). */
export const SET_SEARCH_SET_TYPE_MAX = 16;

const optionalQueryString = <S extends z.ZodType>(schema: S) =>
  z.preprocess((value: unknown) => {
    if (value === undefined || value === '' || value === null) return undefined;
    return value;
  }, schema.optional());

export const setListItemSchema = z.object({
  id: uuidSchema,
  scryfallId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  setType: z.string().nullable(),
  releasedAt: z.string().nullable(),
  cardCount: z.number().int(),
  digital: z.boolean().nullable(),
});

export type SetListItem = z.infer<typeof setListItemSchema>;

export const setSearchPageSchema = z.object({
  sets: z.array(setListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export type SetSearchPage = z.infer<typeof setSearchPageSchema>;

export const setPrintingSummarySchema = z.object({
  id: uuidSchema,
  cardId: uuidSchema,
  cardName: z.string(),
  collectorNumber: z.string(),
  rarity: z.string().nullable(),
  imageNormal: z.string().nullable(),
});

export type SetPrintingSummary = z.infer<typeof setPrintingSummarySchema>;

export const setDetailSchema = setListItemSchema.extend({
  parentSetCode: z.string().nullable(),
  iconSvgUri: z.string().nullable(),
  printings: z.array(setPrintingSummarySchema),
  printingsTotal: z.number(),
  printingsPage: z.number(),
  printingsPageSize: z.number(),
  printingsTotalPages: z.number(),
});

export type SetDetail = z.infer<typeof setDetailSchema>;

/** Comma-separated exact set_type values; match any (OR). */
const setTypeQuerySchema = z.preprocess(
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
  z.array(z.string().min(1).max(40)).min(1).max(SET_SEARCH_SET_TYPE_MAX).optional(),
);

export const setSearchQuerySchema = z.object({
  q: z.string().optional(),
  setType: setTypeQuerySchema,
  digital: queryBoolSchema,
  sort: optionalQueryString(setSearchSortSchema),
  dir: optionalQueryString(sortDirSchema),
  limit: queryIntSchema(1, SET_SEARCH_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type SetSearchQuery = z.infer<typeof setSearchQuerySchema>;

export const setTypeSuggestionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: queryIntSchema(1, SET_TYPE_SUGGESTIONS_MAX_LIMIT),
});

export type SetTypeSuggestionsQuery = z.infer<typeof setTypeSuggestionsQuerySchema>;

export const setTypeSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string()),
});

export type SetTypeSuggestionsResponse = z.infer<typeof setTypeSuggestionsResponseSchema>;

export const setDetailQuerySchema = z.object({
  sort: optionalQueryString(setPrintingSortSchema),
  dir: optionalQueryString(sortDirSchema),
  limit: queryIntSchema(1, SET_PRINTINGS_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type SetDetailQuery = z.infer<typeof setDetailQuerySchema>;
