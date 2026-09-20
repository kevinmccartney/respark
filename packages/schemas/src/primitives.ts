import { z } from 'zod';

/** JSON timestamps: ISO-8601 with `Z` or a numeric offset (`Date.toISOString()` or Postgres JSON). */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Postgres `uuid` columns on the wire. Serial/bigserial PKs stay `z.number()`. */
export const uuidSchema = z.uuid();

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * Query-string integers. Missing or empty stay undefined; non-numeric values fail.
 */
export const queryIntSchema = (min: number, max: number) =>
  z.preprocess((value: unknown) => {
    if (value === undefined || value === '' || value === null) return undefined;
    return value;
  }, z.coerce.number().int().min(min).max(max).optional());
