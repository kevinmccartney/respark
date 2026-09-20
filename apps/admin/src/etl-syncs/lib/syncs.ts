import { apiFetchJson, type GetToken } from '@/core';
import { formatProgressPercent, type JobDisplayStatus } from './format.ts';
import {
  etlSyncLogsResponseSchema,
  etlSyncResponseSchema,
  etlSyncsResponseSchema,
  jobErrorsResponseSchema,
  jobReconciliationResponseSchema,
  jobUnmatchedResponseSchema,
  startEtlSyncResponseSchema,
  type EtlJobRun,
  type EtlSync,
  type EtlSyncLog,
  type IngestionError,
  type IngestionReconciliation,
  type IngestionUnmatched,
} from 'schemas/etl-sync';

export const PAGE_SIZE = 50;

export const JOB_LABELS: Record<string, string> = {
  catalog: 'Scryfall catalog',
  identifiers: 'Printing identifiers',
};

export const STAGE_LABELS: Record<string, string> = {
  catalog: 'Catalog',
  enrichment: 'Enrichment',
};

export const withQuery = (
  path: string,
  params: Record<string, string | number | undefined>,
): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
};

export const fetchEtlSyncs = async (
  getToken: GetToken,
  opts?: { limit?: number; status?: string },
): Promise<EtlSync[]> => {
  const path = withQuery('/admin/etl-syncs', {
    limit: opts?.limit,
    status: opts?.status,
  });
  const body = await apiFetchJson(path, getToken, etlSyncsResponseSchema);
  return body.syncs;
};

export const fetchEtlSync = async (getToken: GetToken, id: string): Promise<EtlSync> => {
  const body = await apiFetchJson(`/admin/etl-syncs/${id}`, getToken, etlSyncResponseSchema);
  return body.sync;
};

export const fetchEtlSyncLogs = async (
  getToken: GetToken,
  syncId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ logs: EtlSyncLog[]; total: number }> => {
  const path = withQuery(`/admin/etl-syncs/${syncId}/logs`, {
    limit: opts?.limit ?? 200,
    offset: opts?.offset,
  });
  return apiFetchJson(path, getToken, etlSyncLogsResponseSchema);
};

export const fetchJobErrors = async (
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ errors: IngestionError[]; total: number }> => {
  const path = withQuery(`/admin/etl-syncs/${syncId}/jobs/${jobRunId}/errors`, {
    limit: opts?.limit,
    offset: opts?.offset,
  });
  return apiFetchJson(path, getToken, jobErrorsResponseSchema);
};

export const fetchJobReconciliation = async (
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
): Promise<IngestionReconciliation | null> => {
  const body = await apiFetchJson(
    `/admin/etl-syncs/${syncId}/jobs/${jobRunId}/reconciliation`,
    getToken,
    jobReconciliationResponseSchema,
  );
  return body.reconciliation;
};

export const fetchJobUnmatched = async (
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ unmatched: IngestionUnmatched[]; total: number }> => {
  const path = withQuery(`/admin/etl-syncs/${syncId}/jobs/${jobRunId}/unmatched`, {
    limit: opts?.limit,
    offset: opts?.offset,
  });
  return apiFetchJson(path, getToken, jobUnmatchedResponseSchema);
};

export type JobArtifacts = {
  errors: IngestionError[];
  totalErrors: number;
  reconciliation: IngestionReconciliation | null;
  unmatched: IngestionUnmatched[];
  totalUnmatched: number;
};

export const loadJobArtifacts = async (
  getToken: GetToken,
  syncId: string,
  job: Pick<EtlJobRun, 'id' | 'job'>,
  opts?: { limit?: number; offset?: number; unmatchedOffset?: number },
): Promise<JobArtifacts> => {
  const limit = opts?.limit ?? PAGE_SIZE;
  const offset = opts?.offset ?? 0;
  const unmatchedOffset = opts?.unmatchedOffset ?? 0;
  const isIdentifiers = job.job === 'identifiers';

  const [errorPage, reconciliation, unmatchedPage] = await Promise.all([
    fetchJobErrors(getToken, syncId, job.id, { limit, offset }),
    isIdentifiers ? fetchJobReconciliation(getToken, syncId, job.id) : Promise.resolve(null),
    isIdentifiers
      ? fetchJobUnmatched(getToken, syncId, job.id, { limit, offset: unmatchedOffset })
      : Promise.resolve({ unmatched: [] as IngestionUnmatched[], total: 0 }),
  ]);

  return {
    errors: errorPage.errors,
    totalErrors: errorPage.total,
    reconciliation,
    unmatched: unmatchedPage.unmatched,
    totalUnmatched: unmatchedPage.total,
  };
};

export const startEtlSync = async (
  getToken: GetToken,
  input: { catalog: boolean; enrichmentJobs: string[] },
): Promise<{ accepted: true; catalog: boolean; enrichmentJobs: string[] }> =>
  apiFetchJson('/admin/etl-syncs', getToken, startEtlSyncResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

export const syncStagesLabel = (sync: EtlSync): string => {
  const parts: string[] = [];
  if (sync.includeCatalog) parts.push('Catalog');
  if (sync.includeEnrichment) {
    const jobs =
      sync.enrichmentJobs.length > 0
        ? sync.enrichmentJobs.map((j) => JOB_LABELS[j] ?? j).join(', ')
        : 'Enrichment';
    parts.push(jobs);
  }
  return parts.length > 0 ? parts.join(' + ') : '—';
};

export type SyncJobSlot = {
  key: string;
  stage: string;
  job: string;
  status: JobDisplayStatus;
  run: EtlJobRun | null;
};

export type SyncStageSlots = {
  stage: string;
  jobs: SyncJobSlot[];
};

const STAGE_ORDER = ['catalog', 'enrichment'];

const plannedJobsForSync = (sync: EtlSync): { stage: string; job: string }[] => {
  const planned: { stage: string; job: string }[] = [];
  if (sync.includeCatalog) planned.push({ stage: 'catalog', job: 'catalog' });
  if (sync.includeEnrichment) {
    const jobs = sync.enrichmentJobs.length > 0 ? sync.enrichmentJobs : ['identifiers'];
    for (const job of jobs) planned.push({ stage: 'enrichment', job });
  }
  return planned;
};

const pendingJobStatus = (sync: EtlSync): 'scheduled' | 'skipped' =>
  sync.status === 'running' ? 'scheduled' : 'skipped';

/** Planned catalog/enrichment jobs, overlaid with any job-run rows that exist. */
export const syncJobSlots = (sync: EtlSync): SyncStageSlots[] => {
  const runByKey = new Map<string, EtlJobRun>();
  for (const stage of sync.stages) {
    for (const job of stage.jobs) {
      runByKey.set(`${job.stage}:${job.job}`, job);
    }
  }

  const slots: SyncJobSlot[] = [];
  const seen = new Set<string>();
  for (const planned of plannedJobsForSync(sync)) {
    const key = `${planned.stage}:${planned.job}`;
    seen.add(key);
    const run = runByKey.get(key) ?? null;
    slots.push({
      key,
      stage: planned.stage,
      job: planned.job,
      status: run?.status ?? pendingJobStatus(sync),
      run,
    });
  }

  for (const [key, run] of runByKey) {
    if (seen.has(key)) continue;
    slots.push({
      key,
      stage: run.stage,
      job: run.job,
      status: run.status,
      run,
    });
  }

  const byStage = new Map<string, SyncJobSlot[]>();
  for (const slot of slots) {
    const list = byStage.get(slot.stage) ?? [];
    list.push(slot);
    byStage.set(slot.stage, list);
  }

  const stages: SyncStageSlots[] = [];
  for (const stage of STAGE_ORDER) {
    const jobs = byStage.get(stage);
    if (jobs) stages.push({ stage, jobs });
  }
  for (const [stage, jobs] of byStage) {
    if (!STAGE_ORDER.includes(stage)) stages.push({ stage, jobs });
  }
  return stages;
};

export const runningJobProgress = (
  sync: EtlSync,
): { percent: number | null; job: string } | undefined => {
  const running = sync.stages
    .flatMap((stage) => stage.jobs)
    .find((job) => job.status === 'running');
  if (!running) return undefined;
  return { job: running.job, percent: running.progressPercent };
};

export const syncListProgressLabel = (
  sync: EtlSync,
  prog?: { percent: number | null; job: string },
): string => {
  if (sync.status !== 'running') return 'Done';
  const liveOrPersisted = prog ?? runningJobProgress(sync);
  if (!liveOrPersisted) return 'Starting…';
  return `${JOB_LABELS[liveOrPersisted.job] ?? liveOrPersisted.job} ${formatProgressPercent(liveOrPersisted.percent)}`;
};

export const syncDurationMs = (sync: EtlSync): number | null => {
  if (!sync.completedAt) return null;
  const start = Date.parse(sync.startedAt);
  const end = Date.parse(sync.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
};
