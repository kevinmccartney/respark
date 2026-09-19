import { useAuth } from '@clerk/react';
import { useEffect, useRef, useState } from 'react';
import { applyAdminLoadError, apiErrorMessage } from '@/lib/errors.ts';
import { connectEtlSyncWs } from '@/lib/etl-ws.ts';
import type {
  EtlJobRun,
  EtlSync,
  IngestionError,
  IngestionReconciliation,
  IngestionUnmatched,
} from 'schemas/etl-sync';
import type { LogLevel } from 'schemas/primitives';
import type { SyncEvent } from 'schemas/sync-event';
import {
  liveErrorFromEvent,
  liveUnmatchedFromEvent,
  patchSyncStatus,
  upsertJobOnSync,
} from '@/lib/sync-state.ts';
import {
  fetchEtlSync,
  loadJobArtifacts,
  fetchJobErrors,
  fetchJobUnmatched,
  PAGE_SIZE,
} from '@/lib/syncs.ts';

export type LiveLog = {
  id: number;
  level: LogLevel;
  message: string;
  at: string;
};

export const useSyncDetail = (id: string | undefined) => {
  const { getToken } = useAuth();

  const [sync, setSync] = useState<EtlSync | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<IngestionReconciliation | null>(null);
  const [unmatched, setUnmatched] = useState<IngestionUnmatched[]>([]);
  const [totalUnmatched, setTotalUnmatched] = useState(0);
  const [unmatchedOffset, setUnmatchedOffset] = useState(0);
  const [unmatchedLoading, setUnmatchedLoading] = useState(false);
  const [errors, setErrors] = useState<IngestionError[]>([]);
  const [totalErrors, setTotalErrors] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [expandedPayload, setExpandedPayload] = useState<number | null>(null);
  const [liveLogs, setLiveLogs] = useState<LiveLog[]>([]);
  const [live, setLive] = useState(false);
  const [progressByJobId, setProgressByJobId] = useState<
    Record<string, { percent: number | null }>
  >({});

  const selectedJobIdRef = useRef<string | null>(null);
  const errorsOffsetRef = useRef(0);
  const unmatchedOffsetRef = useRef(0);
  const logSeqRef = useRef(0);
  const liveRowIdRef = useRef(-1);

  const setSelectedJob = (jobId: string | null) => {
    selectedJobIdRef.current = jobId;
    setSelectedJobId(jobId);
  };

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      setOffset(0);
      setUnmatchedOffset(0);
      errorsOffsetRef.current = 0;
      unmatchedOffsetRef.current = 0;
      try {
        const syncRow = await fetchEtlSync(getToken, id!);
        if (controller.signal.aborted) return;
        setSync(syncRow);
        setProgressByJobId({});

        const allJobs = syncRow.stages.flatMap((s) => s.jobs);
        const preferred = allJobs.find((j) => j.job === 'identifiers') ?? allJobs[0] ?? null;
        const jobId = preferred?.id ?? null;
        setSelectedJob(jobId);

        if (preferred) {
          const artifacts = await loadJobArtifacts(getToken, id!, preferred, {
            limit: PAGE_SIZE,
            offset: 0,
            unmatchedOffset: 0,
          });
          if (controller.signal.aborted) return;
          setErrors(artifacts.errors);
          setTotalErrors(artifacts.totalErrors);
          setReconciliation(artifacts.reconciliation);
          setUnmatched(artifacts.unmatched);
          setTotalUnmatched(artifacts.totalUnmatched);
        } else {
          setErrors([]);
          setTotalErrors(0);
          setReconciliation(null);
          setUnmatched([]);
          setTotalUnmatched(0);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        applyAdminLoadError(err, { setError, setForbidden }, 'Could not load sync');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [getToken, id]);

  useEffect(() => {
    if (!id || forbidden) return;

    const appendLog = (level: LogLevel, message: string) => {
      logSeqRef.current += 1;
      const lineId = logSeqRef.current;
      setLiveLogs((prev) =>
        [
          ...prev,
          {
            id: lineId,
            level,
            message,
            at: new Date().toISOString(),
          },
        ].slice(-200),
      );
    };

    const upsertJob = (job: Partial<EtlJobRun> & { id: string; stage: string; job: string }) => {
      setSync((prev) => (prev ? upsertJobOnSync(prev, job) : prev));
      if (!selectedJobIdRef.current) setSelectedJob(job.id);
    };

    const applyEvent = (event: SyncEvent) => {
      const syncId =
        event.type === 'sync.started' ? event.sync.id : 'syncId' in event ? event.syncId : null;
      if (syncId !== id) return;

      if (event.type === 'sync.updated' || event.type === 'sync.completed') {
        setSync((prev) =>
          prev
            ? patchSyncStatus(prev, {
                status: event.status,
                completedAt: event.completedAt,
                errorMessage: event.errorMessage,
              })
            : prev,
        );
        if (event.type === 'sync.completed') {
          setProgressByJobId({});
        }
        return;
      }

      if (event.type === 'job.started') {
        upsertJob({
          id: event.jobRunId,
          stage: event.stage,
          job: event.job,
          status: event.status,
          startedAt: event.startedAt,
        });
        appendLog('info', `Job started: ${event.stage}/${event.job}`);
        return;
      }

      if (event.type === 'job.updated') {
        upsertJob({
          id: event.jobRunId,
          stage: event.stage,
          job: event.job,
          status: event.status,
          errorMessage: event.errorMessage,
          ...event.metrics,
        });
        return;
      }

      if (event.type === 'job.completed') {
        upsertJob({
          id: event.jobRunId,
          stage: event.stage,
          job: event.job,
          status: event.status,
          completedAt: event.completedAt,
          errorMessage: event.errorMessage,
          ...event.metrics,
        });
        setProgressByJobId((prev) => {
          const next = { ...prev };
          delete next[event.jobRunId];
          return next;
        });
        appendLog(
          event.status === 'failed' ? 'error' : 'info',
          `Job completed: ${event.stage}/${event.job} (${event.status})`,
        );
        return;
      }

      if (event.type === 'job.progress') {
        upsertJob({
          id: event.jobRunId,
          stage: event.stage,
          job: event.job,
          recordsSeen: event.progress.cards,
          recordsInserted: event.progress.inserted,
          recordsUpdated: event.progress.updated,
          recordsUnchanged: event.progress.unchanged,
          recordsFailed: event.progress.failed,
        });
        setProgressByJobId((prev) => ({
          ...prev,
          [event.jobRunId]: { percent: event.progress.percent },
        }));
        return;
      }

      if (event.type === 'job.log') {
        appendLog(event.level, event.message);
        return;
      }

      if (event.type === 'job.error') {
        const selected = selectedJobIdRef.current;
        if (selected && event.jobRunId === selected) {
          setTotalErrors((n) => n + 1);
          if (errorsOffsetRef.current === 0) {
            liveRowIdRef.current -= 1;
            const row = liveErrorFromEvent(event, liveRowIdRef.current);
            setErrors((prev) => [row, ...prev].slice(0, PAGE_SIZE));
          }
        }
        appendLog('error', event.error.errorMessage);
        return;
      }

      if (event.type === 'job.unmatched') {
        const selected = selectedJobIdRef.current;
        if (selected && event.jobRunId === selected) {
          setTotalUnmatched((n) => n + 1);
          if (unmatchedOffsetRef.current === 0) {
            liveRowIdRef.current -= 1;
            const row = liveUnmatchedFromEvent(event, liveRowIdRef.current);
            setUnmatched((prev) => [...prev, row].slice(0, PAGE_SIZE));
          }
        }
      }
    };

    const ws = connectEtlSyncWs(getToken, {
      onOpen: () => {
        setLive(true);
        ws.subscribeSync(id);
      },
      onClose: () => setLive(false),
      onEvent: applyEvent,
    });

    return () => ws.close();
  }, [getToken, id, forbidden]);

  const selectJob = async (job: EtlJobRun) => {
    if (!id) return;
    setSelectedJob(job.id);
    setErrorsLoading(true);
    setUnmatchedLoading(true);
    setOffset(0);
    setUnmatchedOffset(0);
    errorsOffsetRef.current = 0;
    unmatchedOffsetRef.current = 0;
    setExpandedPayload(null);
    try {
      const artifacts = await loadJobArtifacts(getToken, id, job, {
        limit: PAGE_SIZE,
        offset: 0,
        unmatchedOffset: 0,
      });
      setErrors(artifacts.errors);
      setTotalErrors(artifacts.totalErrors);
      setReconciliation(artifacts.reconciliation);
      setUnmatched(artifacts.unmatched);
      setTotalUnmatched(artifacts.totalUnmatched);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load job details'));
    } finally {
      setErrorsLoading(false);
      setUnmatchedLoading(false);
    }
  };

  const loadErrorPage = async (nextOffset: number) => {
    if (!id || !selectedJobIdRef.current) return;
    setErrorsLoading(true);
    try {
      const errorPage = await fetchJobErrors(getToken, id, selectedJobIdRef.current, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setErrors(errorPage.errors);
      setTotalErrors(errorPage.total);
      setOffset(nextOffset);
      errorsOffsetRef.current = nextOffset;
      setExpandedPayload(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load failed rows'));
    } finally {
      setErrorsLoading(false);
    }
  };

  const loadUnmatchedPage = async (nextOffset: number) => {
    if (!id || !selectedJobIdRef.current) return;
    setUnmatchedLoading(true);
    try {
      const page = await fetchJobUnmatched(getToken, id, selectedJobIdRef.current, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setUnmatched(page.unmatched);
      setTotalUnmatched(page.total);
      setUnmatchedOffset(nextOffset);
      unmatchedOffsetRef.current = nextOffset;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load unmatched records'));
    } finally {
      setUnmatchedLoading(false);
    }
  };

  const selectedJob =
    sync?.stages.flatMap((s) => s.jobs).find((j) => j.id === selectedJobId) ?? null;

  const payloadRow =
    expandedPayload == null ? null : (errors.find((e) => e.id === expandedPayload) ?? null);

  return {
    sync,
    selectedJob,
    selectedJobId,
    live,
    loading,
    error,
    forbidden,
    reconciliation,
    unmatched,
    totalUnmatched,
    unmatchedOffset,
    unmatchedLoading,
    errors,
    totalErrors,
    offset,
    errorsLoading,
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
