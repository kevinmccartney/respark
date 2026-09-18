import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { rawSchema } from '../pipeline-schemas'

/**
 * Latest Scryfall card object per printing. `payload` is the full provider JSON;
 * `payload_hash` skips no-op rewrites when the source is unchanged.
 */
export const scryfallCards = rawSchema.table('scryfall_card', {
  scryfallId: uuid('scryfall_id').primaryKey(),
  oracleId: uuid('oracle_id'),
  payload: jsonb('payload').notNull(),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
  payloadHash: text('payload_hash').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ScryfallCardRow = typeof scryfallCards.$inferSelect
