import type { EtlJobRun, EtlSync, SyncEvent } from '@respark/schemas';

import { LIVE_LOG_LIMIT } from '@respark-admin/etl-syncs/constants';

import type { LiveLog, SyncDetailLiveCtx, SyncDetailLivePatch } from '../types';

import {
  liveErrorFromEvent,
  liveUnmatchedFromEvent,
  patchSyncStatus,
  upsertJobOnSync,
} from './sync-state';

export type { LiveLog, SyncDetailLiveCtx, SyncDetailLivePatch };

const eventSyncId = (event: SyncEvent): string | null =>
  event.type === 'sync.started' ? event.sync.id : 'syncId' in event ? event.syncId : null;

/**
 * Pure applicator for sync-detail WebSocket events.
 * Returns null when the event does not apply to this sync.
 */
export const applySyncDetailEvent = (
  event: SyncEvent,
  ctx: SyncDetailLiveCtx,
  liveRowId: number,
): SyncDetailLivePatch | null => {
  if (eventSyncId(event) !== ctx.syncId) {
    return null;
  }

  let nextId = liveRowId;

  const takeId = (): number => {
    nextId -= 1;
    return nextId;
  };

  const patch = (partial: Omit<SyncDetailLivePatch, 'liveRowId'>): SyncDetailLivePatch => ({
    liveRowId: nextId,
    ...partial,
  });

  const upsert =
    (job: Partial<EtlJobRun> & { id: string; stage: string; job: string }) =>
    (prev: EtlSync): EtlSync =>
      upsertJobOnSync(prev, job);

  if (event.type === 'sync.updated' || event.type === 'sync.completed') {
    if (event.type === 'sync.completed') {
      const logId = takeId();
      return patch({
        sync: (prev) =>
          patchSyncStatus(prev, {
            status: event.status,
            completedAt: event.completedAt,
            errorMessage: event.errorMessage,
          }),
        progressClearAll: true,
        log: {
          id: logId,
          level: event.status === 'failed' ? 'error' : 'info',
          message: `ETL sync finished (${event.status})`,
          at: new Date().toISOString(),
        },
      });
    }
    return patch({
      sync: (prev) =>
        patchSyncStatus(prev, {
          status: event.status,
          completedAt: event.completedAt,
          errorMessage: event.errorMessage,
        }),
    });
  }

  if (event.type === 'job.started') {
    const logId = takeId();
    return patch({
      sync: upsert({
        id: event.jobRunId,
        stage: event.stage,
        job: event.job,
        status: event.status,
        startedAt: event.startedAt,
      }),
      selectJobIdIfEmpty: event.jobRunId,
      log: {
        id: logId,
        level: 'info',
        message: `Job started: ${event.stage}/${event.job}`,
        at: new Date().toISOString(),
      },
    });
  }

  if (event.type === 'job.completed') {
    const logId = takeId();
    return patch({
      sync: upsert({
        id: event.jobRunId,
        stage: event.stage,
        job: event.job,
        status: event.status,
        completedAt: event.completedAt,
        errorMessage: event.errorMessage,
        ...event.metrics,
      }),
      progressClearJobId: event.jobRunId,
      log: {
        id: logId,
        level: event.status === 'failed' ? 'error' : 'info',
        message: `Job completed: ${event.stage}/${event.job} (${event.status})`,
        at: new Date().toISOString(),
      },
    });
  }

  if (event.type === 'job.progress') {
    return patch({
      sync: upsert({
        id: event.jobRunId,
        stage: event.stage,
        job: event.job,
        recordsSeen: event.progress.cards,
        recordsInserted: event.progress.inserted,
        recordsUpdated: event.progress.updated,
        recordsUnchanged: event.progress.unchanged,
        recordsFailed: event.progress.failed,
        progressPercent: event.progress.percent,
      }),
      progressSet: { jobRunId: event.jobRunId, percent: event.progress.percent },
    });
  }

  if (event.type === 'job.log') {
    return patch({
      log: {
        id: takeId(),
        level: event.level,
        message: event.message,
        at: new Date().toISOString(),
      },
    });
  }

  if (event.type === 'job.error') {
    const selected = Boolean(ctx.selectedJobId) && event.jobRunId === ctx.selectedJobId;
    const errorPrepend =
      selected && ctx.errorsOffset === 0 ? liveErrorFromEvent(event, takeId()) : undefined;
    return patch({
      errorBumpTotal: selected,
      errorPrepend,
      log: {
        id: takeId(),
        level: 'error',
        message: event.error.errorMessage,
        at: new Date().toISOString(),
      },
    });
  }

  if (event.type === 'job.unmatched') {
    const selected = Boolean(ctx.selectedJobId) && event.jobRunId === ctx.selectedJobId;
    const unmatchedAppend =
      selected && ctx.unmatchedOffset === 0 ? liveUnmatchedFromEvent(event, takeId()) : undefined;
    return patch({
      unmatchedBumpTotal: selected,
      unmatchedAppend,
    });
  }

  return null;
};

export const appendLiveLog = (
  prev: LiveLog[],
  line: LiveLog,
  limit = LIVE_LOG_LIMIT,
): LiveLog[] => {
  if (prev.some((row) => row.level === line.level && row.message === line.message)) {
    return prev;
  }
  return [...prev, line].slice(-limit);
};

export const mergePersistedAndLiveLogs = (
  persisted: LiveLog[],
  liveTail: LiveLog[],
  limit = LIVE_LOG_LIMIT,
): LiveLog[] => {
  const seen = new Set(persisted.map((row) => `${row.level}:${row.message}`));
  const extra = liveTail.filter((row) => !seen.has(`${row.level}:${row.message}`));
  return [...persisted, ...extra].slice(-limit);
};

export const progressFromSync = (sync: EtlSync): Record<string, { percent: number | null }> =>
  Object.fromEntries(
    sync.stages
      .flatMap((stage) => stage.jobs)
      .map((job) => [job.id, { percent: job.progressPercent }]),
  );
