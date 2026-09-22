import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type RefObject } from 'react';

import type { EtlSync, IngestionError, IngestionUnmatched } from '@respark/schemas';
import type { SyncEvent } from '@respark/schemas/sync-event';

import { PAGE_SIZE } from '@respark-admin/etl-syncs/constants';

import { connectEtlSyncWs } from '../api';
import { appendLiveLog, applySyncDetailEvent, progressFromSync } from '../lib';
import type { LiveLog } from '../types';

import { etlSyncKeys } from './syncs';

type JobPageCache = { errors: IngestionError[]; total: number };
type UnmatchedPageCache = { unmatched: IngestionUnmatched[]; total: number };

export type UseEtlSyncDetailLiveOpts = {
  enabled: boolean;
  sync: EtlSync | undefined;
  selectedJobIdRef: RefObject<string | null>;
  errorsOffsetRef: RefObject<number>;
  unmatchedOffsetRef: RefObject<number>;
  setSelectedJob: (jobId: string | null) => void;
};

export const useEtlSyncDetailLive = (
  syncId: string | undefined,
  opts: UseEtlSyncDetailLiveOpts,
) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [progressByJobId, setProgressByJobId] = useState<
    Record<string, { percent: number | null }>
  >({});
  const [liveLogTail, setLiveLogTail] = useState<LiveLog[]>([]);
  const liveRowIdRef = useRef(-1);

  const { enabled, sync, selectedJobIdRef, errorsOffsetRef, unmatchedOffsetRef, setSelectedJob } =
    opts;

  useEffect(() => {
    if (!sync) return;
    setProgressByJobId(progressFromSync(sync));
    setLiveLogTail([]);
    liveRowIdRef.current = -1;
    // Seed progress when navigating to a different sync; ignore row churn from live patches.
  }, [sync?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-seed on sync id change

  useEffect(() => {
    if (!syncId || !enabled) return;

    const applyEvent = (event: SyncEvent) => {
      const patch = applySyncDetailEvent(
        event,
        {
          syncId,
          selectedJobId: selectedJobIdRef.current,
          errorsOffset: errorsOffsetRef.current,
          unmatchedOffset: unmatchedOffsetRef.current,
        },
        liveRowIdRef.current,
      );
      if (!patch) return;

      liveRowIdRef.current = patch.liveRowId;

      if (patch.sync) {
        queryClient.setQueryData<EtlSync>(etlSyncKeys.detail(syncId), (prev) =>
          prev ? patch.sync!(prev) : prev,
        );
      }

      if (patch.progressClearAll) {
        setProgressByJobId({});
      } else if (patch.progressClearJobId) {
        setProgressByJobId((prev) => {
          const next = { ...prev };
          delete next[patch.progressClearJobId!];
          return next;
        });
      } else if (patch.progressSet) {
        setProgressByJobId((prev) => ({
          ...prev,
          [patch.progressSet!.jobRunId]: { percent: patch.progressSet!.percent },
        }));
      }

      if (patch.log) {
        setLiveLogTail((prev) => appendLiveLog(prev, patch.log!));
      }

      if (patch.selectJobIdIfEmpty && !selectedJobIdRef.current) {
        setSelectedJob(patch.selectJobIdIfEmpty);
      }

      if (patch.errorBumpTotal || patch.errorPrepend) {
        const jobRunId = selectedJobIdRef.current;
        if (jobRunId) {
          const pageOpts = { limit: PAGE_SIZE, offset: errorsOffsetRef.current };
          queryClient.setQueryData<JobPageCache>(
            etlSyncKeys.jobErrors(syncId, jobRunId, pageOpts),
            (prev) => {
              if (!prev) {
                if (!patch.errorPrepend) return prev;
                return { errors: [patch.errorPrepend], total: 1 };
              }
              return {
                errors: patch.errorPrepend
                  ? [patch.errorPrepend, ...prev.errors].slice(0, PAGE_SIZE)
                  : prev.errors,
                total: prev.total + 1,
              };
            },
          );
        }
      }

      if (patch.unmatchedBumpTotal || patch.unmatchedAppend) {
        const jobRunId = selectedJobIdRef.current;
        if (jobRunId) {
          const pageOpts = { limit: PAGE_SIZE, offset: unmatchedOffsetRef.current };
          queryClient.setQueryData<UnmatchedPageCache>(
            etlSyncKeys.jobUnmatched(syncId, jobRunId, pageOpts),
            (prev) => {
              if (!prev) {
                if (!patch.unmatchedAppend) return prev;
                return { unmatched: [patch.unmatchedAppend], total: 1 };
              }
              return {
                unmatched: patch.unmatchedAppend
                  ? [...prev.unmatched, patch.unmatchedAppend].slice(0, PAGE_SIZE)
                  : prev.unmatched,
                total: prev.total + 1,
              };
            },
          );
        }
      }
    };

    const ws = connectEtlSyncWs(getToken, {
      onOpen: () => {
        setLive(true);
        ws.subscribeSync(syncId);
      },
      onClose: () => setLive(false),
      onEvent: applyEvent,
    });

    return () => ws.close();
  }, [
    getToken,
    syncId,
    enabled,
    queryClient,
    selectedJobIdRef,
    errorsOffsetRef,
    unmatchedOffsetRef,
    setSelectedJob,
  ]);

  return { live, progressByJobId, liveLogTail };
};
