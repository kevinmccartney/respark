import { jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { rawSchema } from '../pipeline-schemas';

/**
 * Latest MTGJSON card (AllIdentifiers entry) per uuid.
 * Used for identifier enrichment — never creates catalog printings.
 */
export const mtgjsonCards = rawSchema.table('mtgjson_card', {
  mtgjsonUuid: text('mtgjson_uuid').primaryKey(),
  scryfallId: text('scryfall_id'),
  payload: jsonb('payload').notNull(),
  payloadHash: text('payload_hash').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MtgjsonCardRow = typeof mtgjsonCards.$inferSelect;
