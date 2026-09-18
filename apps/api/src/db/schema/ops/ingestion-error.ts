import { bigserial, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { opsSchema } from './ingestion-run'

/**
 * Per-record failures during an ETL run. One bad card should not abort the import.
 */
export const ingestionErrors = opsSchema.table('ingestion_error', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  runId: uuid('run_id').notNull(),
  source: text('source').notNull(),
  externalId: text('external_id'),
  stage: text('stage').notNull(),
  errorMessage: text('error_message').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type IngestionErrorRow = typeof ingestionErrors.$inferSelect
