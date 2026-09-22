import type { Pool, PoolClient } from 'pg';

import type { IngestionRunStatus } from '@respark/schemas/etl-sync';

export type StartJobRunInput = {
  syncId: string;
  stage: string;
  job: string;
  sourceVersion?: string | null;
  sourceUrl?: string | null;
};

export type FinishJobRunInput = {
  runId: string;
  status: IngestionRunStatus;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  downloadBytes?: number | null;
  durationMs: number;
  errorMessage?: string | null;
};

export const startJobRun = async (pool: Pool, input: StartJobRunInput): Promise<string> => {
  const result = await pool.query<{ id: string }>(
    `insert into ops.etl_job_run
       (sync_id, stage, job, status, source_version, source_url)
     values ($1, $2, $3, 'running', $4, $5)
     returning id`,
    [input.syncId, input.stage, input.job, input.sourceVersion ?? null, input.sourceUrl ?? null],
  );
  return result.rows[0].id;
};

export type UpdateJobRunProgressInput = {
  runId: string;
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  progressPercent: number | null;
};

export const updateJobRunProgress = async (
  pool: Pool,
  input: UpdateJobRunProgressInput,
): Promise<void> => {
  await pool.query(
    `update ops.etl_job_run set
       records_seen = $2,
       records_inserted = $3,
       records_updated = $4,
       records_unchanged = $5,
       records_failed = $6,
       progress_percent = $7
     where id = $1`,
    [
      input.runId,
      input.recordsSeen,
      input.recordsInserted,
      input.recordsUpdated,
      input.recordsUnchanged,
      input.recordsFailed,
      input.progressPercent,
    ],
  );
};

export const finishJobRun = async (pool: Pool, input: FinishJobRunInput): Promise<void> => {
  await pool.query(
    `update ops.etl_job_run set
       status = $2,
       completed_at = now(),
       records_seen = $3,
       records_inserted = $4,
       records_updated = $5,
       records_unchanged = $6,
       records_failed = $7,
       download_bytes = $8,
       duration_ms = $9,
       error_message = $10
     where id = $1`,
    [
      input.runId,
      input.status,
      input.recordsSeen,
      input.recordsInserted,
      input.recordsUpdated,
      input.recordsUnchanged,
      input.recordsFailed,
      input.downloadBytes ?? null,
      input.durationMs,
      input.errorMessage ?? null,
    ],
  );
};

export const insertIngestionError = async (
  client: Pool | PoolClient,
  input: {
    runId: string;
    source: string;
    externalId?: string | null;
    stage: string;
    errorMessage: string;
    payload?: unknown;
  },
): Promise<void> => {
  await client.query(
    `insert into ops.ingestion_error
       (run_id, source, external_id, stage, error_message, payload)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.runId,
      input.source,
      input.externalId ?? null,
      input.stage,
      input.errorMessage,
      input.payload === undefined ? null : JSON.stringify(input.payload),
    ],
  );
};
