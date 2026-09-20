import type { Pool } from 'pg';
import type { IngestionRunStatus } from 'schemas/etl-sync';

export type EtlSyncStatus = IngestionRunStatus;

export type StartSyncInput = {
  includeCatalog: boolean;
  includeEnrichment: boolean;
  enrichmentJobs?: string[];
};

export const startEtlSync = async (pool: Pool, input: StartSyncInput): Promise<string> => {
  const enrichmentJobs = input.enrichmentJobs ?? [];
  const result = await pool.query<{ id: string }>(
    `insert into ops.etl_sync
       (status, include_catalog, include_enrichment, enrichment_jobs)
     values ('running', $1, $2, $3)
     returning id`,
    [input.includeCatalog, input.includeEnrichment, enrichmentJobs],
  );
  return result.rows[0].id;
};

export const finishEtlSync = async (
  pool: Pool,
  input: {
    syncId: string;
    status: EtlSyncStatus;
    errorMessage?: string | null;
  },
): Promise<void> => {
  await pool.query(
    `update ops.etl_sync set
       status = $2,
       completed_at = now(),
       error_message = $3
     where id = $1`,
    [input.syncId, input.status, input.errorMessage ?? null],
  );
};

/** Roll up job-run statuses into a single sync status. */
export const rollupSyncStatus = (statuses: IngestionRunStatus[]): EtlSyncStatus => {
  if (statuses.length === 0) return 'failed';
  if (statuses.every((s) => s === 'success')) return 'success';
  if (statuses.every((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'failed' || s === 'partial_success')) {
    return 'partial_success';
  }
  return 'success';
};
