import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { bigserial, index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { etlJobRuns } from './etl-job-run';
import { etlSyncs } from './etl-sync';
import { opsSchema } from './ops-schema';

type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _EtlSyncLogPortableColumn };
export type { _DrizzlePortableColumnBuilder as _EtlSyncLogPortableColumnBuilder };

/**
 * Notable sync/job messages for the admin log panel after a run.
 * Progress ticks are not stored.
 */
export const etlSyncLogs = opsSchema.table(
  'etl_sync_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    syncId: uuid('sync_id')
      .notNull()
      .references(() => etlSyncs.id, { onDelete: 'cascade' }),
    jobRunId: uuid('job_run_id').references(() => etlJobRuns.id, { onDelete: 'set null' }),
    stage: text('stage'),
    job: text('job'),
    level: text('level').notNull(),
    message: text('message').notNull(),
    fields: jsonb('fields'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('etl_sync_log_sync_id_id_idx').on(table.syncId, table.id)],
);

export type EtlSyncLogRow = typeof etlSyncLogs.$inferSelect;
