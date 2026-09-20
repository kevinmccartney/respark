import type { SyncEvent } from 'schemas/sync-event';

export type { SyncEvent };

export type SyncSummary = Extract<SyncEvent, { type: 'sync.started' }>['sync'];
export type JobMetrics = Extract<SyncEvent, { type: 'job.completed' }>['metrics'];
export type JobProgressSnapshot = Extract<SyncEvent, { type: 'job.progress' }>['progress'];

export type SyncEventHandler = (event: SyncEvent) => void;

export const emitSyncEvent = (onEvent: SyncEventHandler | undefined, event: SyncEvent): void => {
  if (!onEvent) return;
  try {
    onEvent(event);
  } catch {
    // Never let a bad subscriber abort the ETL run.
  }
};
