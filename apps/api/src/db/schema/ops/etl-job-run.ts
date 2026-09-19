import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { bigint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { etlSyncs } from './etl-sync';
import { opsSchema } from './ops-schema';

// Imported so `declaration: true` can name inferred table types (see catalog/tables.ts).
type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _EtlJobRunPortableColumn };
export type { _DrizzlePortableColumnBuilder as _EtlJobRunPortableColumnBuilder };

/**
 * One job execution inside an ETL sync (e.g. catalog/catalog or enrichment/identifiers).
 * Status: running | success | partial_success | failed.
 */
export const etlJobRuns = opsSchema.table('etl_job_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  syncId: uuid('sync_id')
    .notNull()
    .references(() => etlSyncs.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  job: text('job').notNull(),
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
});

export type EtlJobRunRow = typeof etlJobRuns.$inferSelect;

/** @deprecated Prefer etlJobRuns. */
export const ingestionRuns = etlJobRuns;
export type IngestionRunRow = EtlJobRunRow;
