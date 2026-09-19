import type { EtlJobRun, EtlSync, IngestionError, IngestionUnmatched } from './schemas/etl-sync.ts';
import type { SyncEvent } from './schemas/sync-event.ts';

export const upsertJobOnSync = (
  sync: EtlSync,
  patch: Partial<EtlJobRun> & { id: string; stage: string; job: string },
): EtlSync => {
  const stages = [...sync.stages];
  let stageIdx = stages.findIndex((s) => s.stage === patch.stage);
  if (stageIdx < 0) {
    stages.push({ stage: patch.stage, jobs: [] });
    stageIdx = stages.length - 1;
  }
  const jobs = [...stages[stageIdx].jobs];
  const jobIdx = jobs.findIndex((j) => j.id === patch.id);
  if (jobIdx >= 0) {
    jobs[jobIdx] = { ...jobs[jobIdx], ...patch };
  } else {
    jobs.push({
      id: patch.id,
      syncId: sync.id,
      stage: patch.stage,
      job: patch.job,
      status: patch.status ?? 'running',
      startedAt: patch.startedAt ?? new Date().toISOString(),
      completedAt: patch.completedAt ?? null,
      sourceVersion: null,
      sourceUrl: null,
      recordsSeen: patch.recordsSeen ?? 0,
      recordsInserted: patch.recordsInserted ?? 0,
      recordsUpdated: patch.recordsUpdated ?? 0,
      recordsUnchanged: patch.recordsUnchanged ?? 0,
      recordsFailed: patch.recordsFailed ?? 0,
      downloadBytes: patch.downloadBytes ?? null,
      durationMs: patch.durationMs ?? null,
      errorMessage: patch.errorMessage ?? null,
    });
  }
  stages[stageIdx] = { ...stages[stageIdx], jobs };
  return { ...sync, stages };
};

export const patchSyncStatus = (
  sync: EtlSync,
  patch: {
    status: EtlSync['status'];
    completedAt: string | null;
    errorMessage: string | null;
  },
): EtlSync => ({ ...sync, ...patch });

export const upsertStartedSync = (
  syncs: EtlSync[],
  event: Extract<SyncEvent, { type: 'sync.started' }>,
): EtlSync[] => {
  const s = event.sync;
  if (syncs.some((x) => x.id === s.id)) {
    return syncs.map((x) =>
      x.id === s.id
        ? {
            ...x,
            status: s.status,
            includeCatalog: s.includeCatalog,
            includeEnrichment: s.includeEnrichment,
            enrichmentJobs: s.enrichmentJobs,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
            errorMessage: s.errorMessage,
          }
        : x,
    );
  }
  const row: EtlSync = {
    id: s.id,
    status: s.status,
    includeCatalog: s.includeCatalog,
    includeEnrichment: s.includeEnrichment,
    enrichmentJobs: s.enrichmentJobs,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    errorMessage: s.errorMessage,
    createdAt: s.startedAt,
    stages: [],
  };
  return [row, ...syncs].slice(0, 100);
};

export const patchSyncInList = (
  syncs: EtlSync[],
  event: Extract<SyncEvent, { type: 'sync.updated' | 'sync.completed' }>,
): EtlSync[] =>
  syncs.map((x) =>
    x.id === event.syncId
      ? {
          ...x,
          status: event.status,
          completedAt: event.completedAt,
          errorMessage: event.errorMessage,
        }
      : x,
  );

export const liveErrorFromEvent = (
  event: Extract<SyncEvent, { type: 'job.error' }>,
  id: number,
): IngestionError => ({
  id,
  runId: event.jobRunId,
  source: event.error.source,
  externalId: event.error.externalId,
  stage: event.error.stage,
  errorMessage: event.error.errorMessage,
  payload: event.error.payload ?? null,
  createdAt: new Date().toISOString(),
});

export const liveUnmatchedFromEvent = (
  event: Extract<SyncEvent, { type: 'job.unmatched' }>,
  id: number,
): IngestionUnmatched => ({
  id,
  runId: event.jobRunId,
  externalId: event.unmatched.externalId,
  name: event.unmatched.name,
  setCode: event.unmatched.setCode,
  collectorNumber: event.unmatched.collectorNumber,
  language: event.unmatched.language,
  scryfallId: event.unmatched.scryfallId,
  reason: event.unmatched.reason,
  createdAt: new Date().toISOString(),
});
