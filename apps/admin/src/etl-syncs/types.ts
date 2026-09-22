import type {
  EtlJobRun,
  EtlSync,
  IngestionError,
  IngestionReconciliation,
  IngestionRunStatus,
  IngestionUnmatched,
  LogLevel,
} from '@respark/schemas';
import type { SyncEvent } from '@respark/schemas/sync-event';

export type EtlSyncsListOpts = {
  limit?: number;
  status?: string;
};

export type EtlSyncLogsOpts = {
  limit?: number;
  offset?: number;
};

export type JobPageOpts = {
  limit?: number;
  offset?: number;
};

export type JobArtifacts = {
  errors: IngestionError[];
  totalErrors: number;
  reconciliation: IngestionReconciliation | null;
  unmatched: IngestionUnmatched[];
  totalUnmatched: number;
};

export type JobDisplayStatus = IngestionRunStatus | 'scheduled' | 'skipped';

export type StatusBadgeProps = {
  variant: 'secondary' | 'destructive' | 'outline';
  className?: string;
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

export type LiveLog = {
  id: number;
  level: LogLevel;
  message: string;
  at: string;
};

export type SyncDetailLiveCtx = {
  syncId: string;
  selectedJobId: string | null;
  errorsOffset: number;
  unmatchedOffset: number;
};

export type SyncDetailLivePatch = {
  /** Next negative id counter after this event (if any ids were consumed). */
  liveRowId: number;
  sync?: (prev: EtlSync) => EtlSync;
  progressClearAll?: boolean;
  progressClearJobId?: string;
  progressSet?: { jobRunId: string; percent: number | null };
  log?: LiveLog;
  selectJobIdIfEmpty?: string;
  /** Selected job received an error; bump total even when not on page 0. */
  errorBumpTotal?: boolean;
  errorPrepend?: IngestionError;
  unmatchedBumpTotal?: boolean;
  unmatchedAppend?: IngestionUnmatched;
};

export type EtlWsHandlers = {
  onEvent?: (event: SyncEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
};
