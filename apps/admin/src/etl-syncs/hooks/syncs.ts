import { useAuth } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { uuidSchema } from '@respark/schemas';

import {
  fetchEtlSync,
  fetchEtlSyncLogs,
  fetchEtlSyncs,
  fetchJobErrors,
  fetchJobReconciliation,
  fetchJobUnmatched,
  postEtlSync,
} from '../api/syncs';
import type { EtlSyncLogsOpts, EtlSyncsListOpts, JobPageOpts } from '../types';

export type { EtlSyncLogsOpts, EtlSyncsListOpts, JobPageOpts };

export const etlSyncKeys = {
  all: ['etl-syncs'] as const,
  lists: () => [...etlSyncKeys.all, 'list'] as const,
  list: (opts: EtlSyncsListOpts = {}) => [...etlSyncKeys.lists(), opts] as const,
  details: () => [...etlSyncKeys.all, 'detail'] as const,
  detail: (id: string) => [...etlSyncKeys.details(), id] as const,
  logs: (id: string, opts: EtlSyncLogsOpts = {}) =>
    [...etlSyncKeys.detail(id), 'logs', opts] as const,
  jobErrors: (syncId: string, jobRunId: string, opts: JobPageOpts = {}) =>
    [...etlSyncKeys.detail(syncId), 'jobs', jobRunId, 'errors', opts] as const,
  jobReconciliation: (syncId: string, jobRunId: string) =>
    [...etlSyncKeys.detail(syncId), 'jobs', jobRunId, 'reconciliation'] as const,
  jobUnmatched: (syncId: string, jobRunId: string, opts: JobPageOpts = {}) =>
    [...etlSyncKeys.detail(syncId), 'jobs', jobRunId, 'unmatched', opts] as const,
};

export const useEtlSyncs = (opts: EtlSyncsListOpts = {}) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: etlSyncKeys.list(opts),
    queryFn: ({ signal }) => fetchEtlSyncs(getToken, opts, { signal }),
  });
};

export const useEtlSync = (id: string) => {
  const { getToken } = useAuth();
  const validId = uuidSchema.safeParse(id).success;
  return useQuery({
    queryKey: etlSyncKeys.detail(id),
    queryFn: ({ signal }) => fetchEtlSync(getToken, id, { signal }),
    enabled: validId,
  });
};

export const useEtlSyncLogs = (syncId: string, opts: EtlSyncLogsOpts = {}, enabled = true) => {
  const { getToken } = useAuth();
  const validId = uuidSchema.safeParse(syncId).success;
  return useQuery({
    queryKey: etlSyncKeys.logs(syncId, opts),
    queryFn: ({ signal }) => fetchEtlSyncLogs(getToken, syncId, opts, { signal }),
    enabled: validId && enabled,
  });
};

export const useJobErrors = (
  syncId: string,
  jobRunId: string | null,
  opts: JobPageOpts = {},
  enabled = true,
) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: etlSyncKeys.jobErrors(syncId, jobRunId ?? '', opts),
    queryFn: ({ signal }) => fetchJobErrors(getToken, syncId, jobRunId!, opts, { signal }),
    enabled: Boolean(jobRunId) && enabled,
  });
};

export const useJobReconciliation = (syncId: string, jobRunId: string | null, enabled = true) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: etlSyncKeys.jobReconciliation(syncId, jobRunId ?? ''),
    queryFn: ({ signal }) => fetchJobReconciliation(getToken, syncId, jobRunId!, { signal }),
    enabled: Boolean(jobRunId) && enabled,
  });
};

export const useJobUnmatched = (
  syncId: string,
  jobRunId: string | null,
  opts: JobPageOpts = {},
  enabled = true,
) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: etlSyncKeys.jobUnmatched(syncId, jobRunId ?? '', opts),
    queryFn: ({ signal }) => fetchJobUnmatched(getToken, syncId, jobRunId!, opts, { signal }),
    enabled: Boolean(jobRunId) && enabled,
  });
};

export const useStartEtlSync = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { catalog: boolean; enrichmentJobs: string[] }) =>
      postEtlSync(getToken, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: etlSyncKeys.lists() });
    },
  });
};
