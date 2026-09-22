import { useCallback, useEffect, useRef, useState } from 'react';

import { uuidSchema, type EtlJobRun } from '@respark/schemas';

import { adminQueryErrorState } from '@respark-admin/core/lib';
import { PAGE_SIZE, SYNC_LOGS_LIMIT } from '@respark-admin/etl-syncs/constants';

import { mergePersistedAndLiveLogs } from '../lib';
import type { LiveLog } from '../types';

import {
  useEtlSync,
  useEtlSyncLogs,
  useJobErrors,
  useJobReconciliation,
  useJobUnmatched,
} from './syncs';
import { useEtlSyncDetailLive } from './useEtlSyncDetailLive';

export type { LiveLog } from '../types';

const LOGS_OPTS = { limit: SYNC_LOGS_LIMIT } as const;

const preferredJobId = (jobs: EtlJobRun[]): string | null => {
  const preferred = jobs.find((j) => j.job === 'identifiers') ?? jobs[0] ?? null;
  return preferred?.id ?? null;
};

export const useSyncDetail = (id: string | undefined) => {
  const validId = Boolean(id) && uuidSchema.safeParse(id).success;
  const syncId = validId ? id! : '';

  const syncQuery = useEtlSync(syncId);
  const sync = syncQuery.data;
  const {
    forbidden,
    notFound: errorNotFound,
    message: loadError,
  } = adminQueryErrorState(syncQuery.error, 'Could not load sync');

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [unmatchedOffset, setUnmatchedOffset] = useState(0);
  const [expandedPayload, setExpandedPayload] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedJobIdRef = useRef<string | null>(null);
  const errorsOffsetRef = useRef(0);
  const unmatchedOffsetRef = useRef(0);

  const setSelectedJob = useCallback((jobId: string | null) => {
    selectedJobIdRef.current = jobId;
    setSelectedJobId(jobId);
  }, []);

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  useEffect(() => {
    errorsOffsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    unmatchedOffsetRef.current = unmatchedOffset;
  }, [unmatchedOffset]);

  useEffect(() => {
    setSelectedJob(null);
    setOffset(0);
    setUnmatchedOffset(0);
    setExpandedPayload(null);
    setActionError(null);
    errorsOffsetRef.current = 0;
    unmatchedOffsetRef.current = 0;
  }, [syncId, setSelectedJob]);

  useEffect(() => {
    if (!sync) return;
    const jobs = sync.stages.flatMap((s) => s.jobs);
    if (selectedJobId && jobs.some((j) => j.id === selectedJobId)) return;
    setSelectedJob(preferredJobId(jobs));
  }, [sync, selectedJobId, setSelectedJob]);

  const logsQuery = useEtlSyncLogs(syncId, LOGS_OPTS, validId && !forbidden && !errorNotFound);
  const selectedJob =
    sync?.stages.flatMap((s) => s.jobs).find((j) => j.id === selectedJobId) ?? null;
  const isIdentifiers = selectedJob?.job === 'identifiers';

  const errorsOpts = { limit: PAGE_SIZE, offset };
  const unmatchedOpts = { limit: PAGE_SIZE, offset: unmatchedOffset };

  const errorsQuery = useJobErrors(
    syncId,
    selectedJobId,
    errorsOpts,
    Boolean(selectedJobId) && !forbidden,
  );
  const reconciliationQuery = useJobReconciliation(
    syncId,
    selectedJobId,
    Boolean(selectedJobId) && isIdentifiers && !forbidden,
  );
  const unmatchedQuery = useJobUnmatched(
    syncId,
    selectedJobId,
    unmatchedOpts,
    Boolean(selectedJobId) && isIdentifiers && !forbidden,
  );

  const { live, progressByJobId, liveLogTail } = useEtlSyncDetailLive(validId ? id : undefined, {
    enabled: validId && !forbidden && !errorNotFound,
    sync,
    selectedJobIdRef,
    errorsOffsetRef,
    unmatchedOffsetRef,
    setSelectedJob,
  });

  const persistedLogs: LiveLog[] =
    logsQuery.data?.logs.map((row) => ({
      id: row.id,
      level: row.level,
      message: row.message,
      at: row.createdAt,
    })) ?? [];
  const liveLogs = mergePersistedAndLiveLogs(persistedLogs, liveLogTail);

  const errors = errorsQuery.data?.errors ?? [];
  const totalErrors = errorsQuery.data?.total ?? 0;
  const unmatched = unmatchedQuery.data?.unmatched ?? [];
  const totalUnmatched = unmatchedQuery.data?.total ?? 0;
  const reconciliation = reconciliationQuery.data ?? null;

  const payloadRow =
    expandedPayload == null ? null : (errors.find((e) => e.id === expandedPayload) ?? null);

  const selectJob = (job: EtlJobRun) => {
    setSelectedJob(job.id);
    setOffset(0);
    setUnmatchedOffset(0);
    errorsOffsetRef.current = 0;
    unmatchedOffsetRef.current = 0;
    setExpandedPayload(null);
    setActionError(null);
  };

  const loadErrorPage = (nextOffset: number) => {
    setOffset(nextOffset);
    errorsOffsetRef.current = nextOffset;
    setExpandedPayload(null);
  };

  const loadUnmatchedPage = (nextOffset: number) => {
    setUnmatchedOffset(nextOffset);
    unmatchedOffsetRef.current = nextOffset;
  };

  const queryError =
    errorsQuery.error ?? reconciliationQuery.error ?? unmatchedQuery.error ?? logsQuery.error;
  const { message: childError } = adminQueryErrorState(queryError, 'Could not load job details');

  const notFound = Boolean(id) && (!validId || errorNotFound);

  return {
    sync: sync ?? null,
    selectedJob,
    selectedJobId,
    live,
    loading: validId && syncQuery.isPending,
    error: actionError ?? loadError ?? childError,
    forbidden,
    notFound,
    reconciliation,
    unmatched,
    totalUnmatched,
    unmatchedOffset,
    unmatchedLoading: unmatchedQuery.isFetching,
    errors,
    totalErrors,
    offset,
    errorsLoading: errorsQuery.isFetching,
    expandedPayload,
    setExpandedPayload,
    payloadRow,
    liveLogs,
    progressByJobId,
    selectJob,
    loadErrorPage,
    loadUnmatchedPage,
  };
};
