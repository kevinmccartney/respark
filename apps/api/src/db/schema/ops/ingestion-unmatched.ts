import { bigserial, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { etlJobRuns } from './etl-job-run';
import { opsSchema } from './ops-schema';

/**
 * Sampled unmatched records from an identifiers job reconciliation.
 */
export const ingestionUnmatched = opsSchema.table(
  'ingestion_unmatched',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => etlJobRuns.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    name: text('name'),
    setCode: text('set_code'),
    collectorNumber: text('collector_number'),
    language: text('language'),
    scryfallId: text('scryfall_id'),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ingestion_unmatched_run_id_id_idx').on(table.runId, table.id)],
);

export type IngestionUnmatchedRow = typeof ingestionUnmatched.$inferSelect;
