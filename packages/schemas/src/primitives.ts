import { z } from 'zod';

/** JSON timestamps: ISO-8601 with `Z` or a numeric offset (`Date.toISOString()` or Postgres JSON). */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Postgres `uuid` columns on the wire. Serial/bigserial PKs stay `z.number()`. */
export const uuidSchema = z.uuid();

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export type LogLevel = z.infer<typeof logLevelSchema>;

export const SORT_DIRS = ['asc', 'desc'] as const;
export const sortDirSchema = z.enum(SORT_DIRS);
export type SortDir = z.infer<typeof sortDirSchema>;

/**
 * Query-string integers. Missing or empty stay undefined; non-numeric values fail.
 */
export const queryIntSchema = (min: number, max: number) =>
  z.preprocess((value: unknown) => {
    if (value === undefined || value === '' || value === null) return undefined;
    return value;
  }, z.coerce.number().int().min(min).max(max).optional());

/** Query-string booleans (`true`/`false`/`1`/`0`). Missing or empty stay undefined. */
export const queryBoolSchema = z.preprocess((value: unknown) => {
  if (value === undefined || value === '' || value === null) return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}, z.boolean().optional());

/** One face of a printing (DFC, MDFC, split, adventure, …). */
export const cardFaceSchema = z.object({
  faceIndex: z.number().int().nonnegative(),
  name: z.string().nullable(),
  manaCost: z.string().nullable(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  imageNormal: z.string().nullable(),
  imageLarge: z.string().nullable(),
});

export type CardFace = z.infer<typeof cardFaceSchema>;

export const parseCardFaces = (raw: unknown): CardFace[] => {
  const value = typeof raw === 'string' ? parseJson(raw) : raw;
  const parsed = z.array(cardFaceSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
};

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};
