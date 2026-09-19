import type { Pool } from 'pg';
import type { SyncEvent } from '../core/stream-events';

export type InsertEtlSyncLog = {
  syncId: string;
  jobRunId: string | null;
  stage: string | null;
  job: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields: Record<string, unknown> | null;
};

export const syncLogFromEvent = (event: SyncEvent): InsertEtlSyncLog | null => {
  switch (event.type) {
    case 'job.log':
      return {
        syncId: event.syncId,
        jobRunId: event.jobRunId,
        stage: event.stage,
        job: event.job,
        level: event.level,
        message: event.message,
        fields: event.fields ?? null,
      };
    case 'job.started':
      return {
        syncId: event.syncId,
        jobRunId: event.jobRunId,
        stage: event.stage,
        job: event.job,
        level: 'info',
        message: `Job started: ${event.stage}/${event.job}`,
        fields: null,
      };
    case 'job.completed':
      return {
        syncId: event.syncId,
        jobRunId: event.jobRunId,
        stage: event.stage,
        job: event.job,
        level: event.status === 'failed' ? 'error' : 'info',
        message: `Job completed: ${event.stage}/${event.job} (${event.status})`,
        fields: event.errorMessage ? { errorMessage: event.errorMessage } : null,
      };
    case 'sync.completed':
      return {
        syncId: event.syncId,
        jobRunId: null,
        stage: null,
        job: null,
        level: event.status === 'failed' ? 'error' : 'info',
        message: `ETL sync finished (${event.status})`,
        fields: event.errorMessage ? { errorMessage: event.errorMessage } : null,
      };
    default:
      return null;
  }
};

export const insertEtlSyncLog = async (pool: Pool, input: InsertEtlSyncLog): Promise<void> => {
  await pool.query(
    `insert into ops.etl_sync_log
       (sync_id, job_run_id, stage, job, level, message, fields)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.syncId,
      input.jobRunId,
      input.stage,
      input.job,
      input.level,
      input.message,
      input.fields === null ? null : JSON.stringify(input.fields),
    ],
  );
};
