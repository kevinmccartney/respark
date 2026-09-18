import { bigint, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * ETL operational schema. Catalog/raw/market/app schemas are created in the same
 * migration; tables land there in later phases.
 */
export const opsSchema = pgSchema('ops')

/**
 * One row per ETL source execution. Status values: running | success |
 * partial_success | failed.
 */
export const ingestionRuns = opsSchema.table('ingestion_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  sourceVersion: text('source_version'),
  sourceUrl: text('source_url'),
  recordsSeen: bigint('records_seen', { mode: 'number' }).notNull().default(0),
  recordsInserted: bigint('records_inserted', { mode: 'number' }).notNull().default(0),
  recordsUpdated: bigint('records_updated', { mode: 'number' }).notNull().default(0),
  recordsUnchanged: bigint('records_unchanged', { mode: 'number' }).notNull().default(0),
  recordsFailed: bigint('records_failed', { mode: 'number' }).notNull().default(0),
  downloadBytes: bigint('download_bytes', { mode: 'number' }),
  durationMs: bigint('duration_ms', { mode: 'number' }),
  errorMessage: text('error_message'),
})

export type IngestionRunRow = typeof ingestionRuns.$inferSelect
