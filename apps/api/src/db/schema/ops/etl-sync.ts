import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { opsSchema } from './ops-schema';

// Imported so `declaration: true` can name inferred table types (see catalog/tables.ts).
type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _EtlSyncPortableColumn };
export type { _DrizzlePortableColumnBuilder as _EtlSyncPortableColumnBuilder };

/**
 * One user-triggered ETL sync. Contains 1–2 stages (catalog / enrichment),
 * each with one or more jobs.
 */
export const etlSyncs = opsSchema.table('etl_sync', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status').notNull(),
  includeCatalog: boolean('include_catalog').notNull(),
  includeEnrichment: boolean('include_enrichment').notNull(),
  enrichmentJobs: text('enrichment_jobs').array().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EtlSyncRow = typeof etlSyncs.$inferSelect;
