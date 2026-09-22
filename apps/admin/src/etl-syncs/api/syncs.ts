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
} from '@respark/schemas';

import { apiFetchJson, type GetToken } from '@respark-admin/core/lib';
import { PAGE_SIZE, SYNC_LOGS_LIMIT } from '@respark-admin/etl-syncs/constants';

import type { EtlSyncLogsOpts, EtlSyncsListOpts, JobArtifacts, JobPageOpts } from '../types';

export type { EtlSyncLogsOpts, EtlSyncsListOpts, JobArtifacts, JobPageOpts };

export const toQueryString = (
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
  opts?: EtlSyncsListOpts,
  init?: RequestInit,
): Promise<EtlSync[]> => {
  const path = toQueryString('/admin/etl-syncs', {
    limit: opts?.limit,
    status: opts?.status,
  });
  const body = await apiFetchJson(path, getToken, etlSyncsResponseSchema, init);
  return body.syncs;
};

export const fetchEtlSync = async (
  getToken: GetToken,
  id: string,
  init?: RequestInit,
): Promise<EtlSync> => {
  const body = await apiFetchJson(`/admin/etl-syncs/${id}`, getToken, etlSyncResponseSchema, init);
  return body.sync;
};

export const fetchEtlSyncLogs = async (
  getToken: GetToken,
  syncId: string,
  opts?: EtlSyncLogsOpts,
  init?: RequestInit,
): Promise<{ logs: EtlSyncLog[]; total: number }> => {
  const path = toQueryString(`/admin/etl-syncs/${syncId}/logs`, {
    limit: opts?.limit ?? SYNC_LOGS_LIMIT,
    offset: opts?.offset,
  });
  return apiFetchJson(path, getToken, etlSyncLogsResponseSchema, init);
};

export const fetchJobErrors = async (
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  opts?: JobPageOpts,
  init?: RequestInit,
): Promise<{ errors: IngestionError[]; total: number }> => {
  const path = toQueryString(`/admin/etl-syncs/${syncId}/jobs/${jobRunId}/errors`, {
    limit: opts?.limit,
    offset: opts?.offset,
  });
  return apiFetchJson(path, getToken, jobErrorsResponseSchema, init);
};

export const fetchJobReconciliation = async (
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  init?: RequestInit,
): Promise<IngestionReconciliation | null> => {
  const body = await apiFetchJson(
    `/admin/etl-syncs/${syncId}/jobs/${jobRunId}/reconciliation`,
    getToken,
    jobReconciliationResponseSchema,
    init,
  );
  return body.reconciliation;
};

export const fetchJobUnmatched = async (
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  opts?: JobPageOpts,
  init?: RequestInit,
): Promise<{ unmatched: IngestionUnmatched[]; total: number }> => {
  const path = toQueryString(`/admin/etl-syncs/${syncId}/jobs/${jobRunId}/unmatched`, {
    limit: opts?.limit,
    offset: opts?.offset,
  });
  return apiFetchJson(path, getToken, jobUnmatchedResponseSchema, init);
};

export const fetchJobArtifacts = async (
  getToken: GetToken,
  syncId: string,
  job: Pick<EtlJobRun, 'id' | 'job'>,
  opts?: { limit?: number; offset?: number; unmatchedOffset?: number },
  init?: RequestInit,
): Promise<JobArtifacts> => {
  const limit = opts?.limit ?? PAGE_SIZE;
  const offset = opts?.offset ?? 0;
  const unmatchedOffset = opts?.unmatchedOffset ?? 0;
  const isIdentifiers = job.job === 'identifiers';

  const [errorPage, reconciliation, unmatchedPage] = await Promise.all([
    fetchJobErrors(getToken, syncId, job.id, { limit, offset }, init),
    isIdentifiers ? fetchJobReconciliation(getToken, syncId, job.id, init) : Promise.resolve(null),
    isIdentifiers
      ? fetchJobUnmatched(getToken, syncId, job.id, { limit, offset: unmatchedOffset }, init)
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

export const postEtlSync = async (
  getToken: GetToken,
  input: { catalog: boolean; enrichmentJobs: string[] },
  init?: RequestInit,
): Promise<{ accepted: true; catalog: boolean; enrichmentJobs: string[] }> =>
  apiFetchJson('/admin/etl-syncs', getToken, startEtlSyncResponseSchema, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
