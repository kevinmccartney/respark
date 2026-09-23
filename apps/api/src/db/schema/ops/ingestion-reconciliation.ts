import { bigint, boolean, integer, timestamp, uuid } from 'drizzle-orm/pg-core';

import { etlJobRuns } from './etl-job-run';
import { opsSchema } from './ops-schema';

/**
 * One reconciliation summary per identifiers job run.
 * Ambiguous detail rows live in ops.ingestion_error.
 */
export const ingestionReconciliations = opsSchema.table('ingestion_reconciliation', {
  runId: uuid('run_id')
    .primaryKey()
    .references(() => etlJobRuns.id, { onDelete: 'cascade' }),
  matched: bigint('matched', { mode: 'number' }).notNull().default(0),
  unmatched: bigint('unmatched', { mode: 'number' }).notNull().default(0),
  ambiguous: bigint('ambiguous', { mode: 'number' }).notNull().default(0),
  identifiersAdded: bigint('identifiers_added', { mode: 'number' }).notNull().default(0),
  rawInserted: bigint('raw_inserted', { mode: 'number' }),
  rawUpdated: bigint('raw_updated', { mode: 'number' }),
  rawUnchanged: bigint('raw_unchanged', { mode: 'number' }),
  storeRaw: boolean('store_raw'),
  demoMismatches: boolean('demo_mismatches').notNull().default(false),
  dryRun: boolean('dry_run').notNull().default(false),
  limitN: integer('limit_n'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type IngestionReconciliationRow = typeof ingestionReconciliations.$inferSelect;
