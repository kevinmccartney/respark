import type { IngestionRunStatus } from './types';

export type SyncSummary = {
  id: string;
  status: IngestionRunStatus;
  includeCatalog: boolean;
  includeEnrichment: boolean;
  enrichmentJobs: string[];
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
};

export type JobMetrics = {
  recordsSeen: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  downloadBytes: number | null;
  durationMs: number | null;
};

export type JobProgressSnapshot = {
  current: number;
  total: number | null;
  cards: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  percent: number | null;
};

export type SyncEvent =
  | {
      type: 'sync.started';
      sync: SyncSummary;
    }
  | {
      type: 'sync.updated';
      syncId: string;
      status: IngestionRunStatus;
      completedAt: string | null;
      errorMessage: string | null;
    }
  | {
      type: 'sync.completed';
      syncId: string;
      status: IngestionRunStatus;
      completedAt: string;
      errorMessage: string | null;
    }
  | {
      type: 'job.started';
      syncId: string;
      jobRunId: string;
      stage: string;
      job: string;
      status: IngestionRunStatus;
      startedAt: string;
    }
  | {
      type: 'job.updated';
      syncId: string;
      jobRunId: string;
      stage: string;
      job: string;
      status: IngestionRunStatus;
      metrics: JobMetrics;
      errorMessage: string | null;
    }
  | {
      type: 'job.completed';
      syncId: string;
      jobRunId: string;
      stage: string;
      job: string;
      status: IngestionRunStatus;
      metrics: JobMetrics;
      completedAt: string;
      errorMessage: string | null;
    }
  | {
      type: 'job.progress';
      syncId: string;
      jobRunId: string;
      stage: string;
      job: string;
      progress: JobProgressSnapshot;
    }
  | {
      type: 'job.log';
      syncId: string;
      jobRunId: string | null;
      stage: string | null;
      job: string | null;
      level: 'info' | 'warn' | 'error' | 'debug';
      message: string;
      fields?: Record<string, unknown>;
    }
  | {
      type: 'job.error';
      syncId: string;
      jobRunId: string;
      error: {
        source: string;
        externalId: string | null;
        stage: string;
        errorMessage: string;
        payload?: unknown;
      };
    }
  | {
      type: 'job.unmatched';
      syncId: string;
      jobRunId: string;
      unmatched: {
        externalId: string;
        name: string | null;
        setCode: string | null;
        collectorNumber: string | null;
        language: string | null;
        scryfallId: string | null;
        reason: string;
      };
    };

export type SyncEventHandler = (event: SyncEvent) => void;

export function emitSyncEvent(onEvent: SyncEventHandler | undefined, event: SyncEvent): void {
  if (!onEvent) return;
  try {
    onEvent(event);
  } catch {
    // Never let a bad subscriber abort the ETL run.
  }
}
