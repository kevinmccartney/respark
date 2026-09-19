import type { Pool } from 'pg';
import type { Logger } from '../core/logger';
import { emitSyncEvent, type SyncEventHandler } from '../core/stream-events';
import type { GlobalFlags, IngestionRunStatus } from '../core/types';
import { finishEtlSync, rollupSyncStatus, startEtlSync } from '../repositories/etlSyncs';
import { runMtgjsonImport } from '../sources/mtgjson/importer';
import { runScryfallImport } from '../sources/scryfall/importer';

export const ENRICHMENT_JOB_IDS = ['identifiers'] as const;
export type EnrichmentJobId = (typeof ENRICHMENT_JOB_IDS)[number];

export type SyncOptions = GlobalFlags & {
  catalog: boolean;
  enrichmentJobs: EnrichmentJobId[];
};

export type RunEtlSyncHooks = {
  onEvent?: SyncEventHandler;
};

const jobOk = (status: IngestionRunStatus): boolean =>
  status === 'success' || status === 'partial_success';

/**
 * Run one ETL sync: optional catalog stage, then optional enrichment jobs.
 * Creates ops.etl_sync and rolls up status from job runs.
 * Callers (CLI or API) supply an optional onEvent sink for live updates.
 */
export const runEtlSync = async (
  pool: Pool,
  logger: Logger,
  options: SyncOptions,
  hooks: RunEtlSyncHooks = {},
): Promise<IngestionRunStatus> => {
  if (!options.catalog && options.enrichmentJobs.length === 0) {
    throw new Error('sync requires --catalog and/or --enrichment <job>');
  }

  const onEvent = hooks.onEvent;
  const startedAt = new Date().toISOString();

  const syncId = await startEtlSync(pool, {
    includeCatalog: options.catalog,
    includeEnrichment: options.enrichmentJobs.length > 0,
    enrichmentJobs: options.enrichmentJobs,
  });

  emitSyncEvent(onEvent, {
    type: 'sync.started',
    sync: {
      id: syncId,
      status: 'running',
      includeCatalog: options.catalog,
      includeEnrichment: options.enrichmentJobs.length > 0,
      enrichmentJobs: [...options.enrichmentJobs],
      startedAt,
      completedAt: null,
      errorMessage: null,
    },
  });

  logger.info(
    {
      event: 'etl.sync.start',
      syncId,
      catalog: options.catalog,
      enrichmentJobs: options.enrichmentJobs,
    },
    'ETL sync started',
  );
  emitSyncEvent(onEvent, {
    type: 'job.log',
    syncId,
    jobRunId: null,
    stage: null,
    job: null,
    level: 'info',
    message: 'ETL sync started',
    fields: {
      catalog: options.catalog,
      enrichmentJobs: options.enrichmentJobs,
    },
  });

  const statuses: IngestionRunStatus[] = [];
  let fatalError: string | null = null;
  const jobCtx = { syncId, onEvent };

  try {
    if (options.catalog) {
      const catalogStatus = await runScryfallImport(pool, logger, options, jobCtx);
      statuses.push(catalogStatus);

      if (!jobOk(catalogStatus) && options.enrichmentJobs.length > 0) {
        logger.warn(
          { event: 'etl.sync.skip_enrichment', syncId, catalogStatus },
          'Catalog job did not succeed — skipping enrichment',
        );
        emitSyncEvent(onEvent, {
          type: 'job.log',
          syncId,
          jobRunId: null,
          stage: 'catalog',
          job: 'catalog',
          level: 'warn',
          message: 'Catalog job did not succeed — skipping enrichment',
          fields: { catalogStatus },
        });
        const status = rollupSyncStatus(statuses);
        await finishEtlSync(pool, { syncId, status });
        const completedAt = new Date().toISOString();
        emitSyncEvent(onEvent, {
          type: 'sync.completed',
          syncId,
          status,
          completedAt,
          errorMessage: null,
        });
        return status;
      }
    }

    for (const job of options.enrichmentJobs) {
      if (job === 'identifiers') {
        const status = await runMtgjsonImport(pool, logger, options, jobCtx);
        statuses.push(status);
      } else {
        throw new Error(`Unknown enrichment job: ${job}`);
      }
    }
  } catch (err) {
    fatalError = err instanceof Error ? err.message : String(err);
    logger.error({ event: 'etl.sync.failed', syncId, err: fatalError }, 'ETL sync failed');
    const status = statuses.length ? rollupSyncStatus([...statuses, 'failed']) : 'failed';
    await finishEtlSync(pool, {
      syncId,
      status,
      errorMessage: fatalError,
    });
    const completedAt = new Date().toISOString();
    emitSyncEvent(onEvent, {
      type: 'sync.updated',
      syncId,
      status,
      completedAt,
      errorMessage: fatalError,
    });
    emitSyncEvent(onEvent, {
      type: 'sync.completed',
      syncId,
      status,
      completedAt,
      errorMessage: fatalError,
    });
    throw err;
  }

  const status = rollupSyncStatus(statuses);
  await finishEtlSync(pool, { syncId, status });
  const completedAt = new Date().toISOString();
  logger.info({ event: 'etl.sync.complete', syncId, status }, 'ETL sync finished');
  emitSyncEvent(onEvent, {
    type: 'sync.completed',
    syncId,
    status,
    completedAt,
    errorMessage: null,
  });
  return status;
};

export const parseEnrichmentJobs = (raw: string | string[] | undefined): EnrichmentJobId[] => {
  if (raw === undefined) return [];
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);

  const jobs: EnrichmentJobId[] = [];
  for (const part of parts) {
    if (part === 'identifiers') {
      if (!jobs.includes('identifiers')) jobs.push('identifiers');
    } else {
      throw new Error(
        `Unknown enrichment job "${part}". Expected: ${ENRICHMENT_JOB_IDS.join(', ')}`,
      );
    }
  }
  return jobs;
};
