import { z } from 'zod';

/** JSON wire format for timestamps (`Date.toISOString()`, always UTC `Z`). */
export const isoDateTimeSchema = z.iso.datetime();

/** Postgres `uuid` columns on the wire. Serial/bigserial PKs stay `z.number()`. */
export const uuidSchema = z.uuid();

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export type LogLevel = z.infer<typeof logLevelSchema>;
