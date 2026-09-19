import { apiFetchJson, type GetToken } from './api.ts';
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

export const syncDurationMs = (sync: EtlSync): number | null => {
  if (!sync.completedAt) return null;
  const start = Date.parse(sync.startedAt);
  const end = Date.parse(sync.completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
};
