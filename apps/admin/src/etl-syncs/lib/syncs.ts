import type { EtlJobRun, EtlSync } from '@respark/schemas';

import { JOB_LABELS, STAGE_ORDER } from '@respark-admin/etl-syncs/constants';

import type { SyncJobSlot, SyncStageSlots } from '../types';

import { formatProgressPercent } from './format';

export type { SyncJobSlot, SyncStageSlots };

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
    if (!(STAGE_ORDER as readonly string[]).includes(stage)) stages.push({ stage, jobs });
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
