import type { Pool } from 'pg'
import type { Logger } from '../core/logger'
import type { GlobalFlags, IngestionRunStatus } from '../core/types'
import {
  finishEtlSync,
  rollupSyncStatus,
  startEtlSync,
} from '../repositories/etlSyncs'
import { runMtgjsonImport } from '../sources/mtgjson/importer'
import { runScryfallImport } from '../sources/scryfall/importer'

export const ENRICHMENT_JOB_IDS = ['identifiers'] as const
export type EnrichmentJobId = (typeof ENRICHMENT_JOB_IDS)[number]

export type SyncOptions = GlobalFlags & {
  catalog: boolean
  enrichmentJobs: EnrichmentJobId[]
}

function jobOk(status: IngestionRunStatus): boolean {
  return status === 'success' || status === 'partial_success'
}

/**
 * Run one ETL sync: optional catalog stage, then optional enrichment jobs.
 * Creates ops.etl_sync and rolls up status from job runs.
 */
export async function runEtlSync(
  pool: Pool,
  logger: Logger,
  options: SyncOptions,
): Promise<IngestionRunStatus> {
  if (!options.catalog && options.enrichmentJobs.length === 0) {
    throw new Error('sync requires --catalog and/or --enrichment <job>')
  }

  const syncId = await startEtlSync(pool, {
    includeCatalog: options.catalog,
    includeEnrichment: options.enrichmentJobs.length > 0,
    enrichmentJobs: options.enrichmentJobs,
  })

  logger.info(
    {
      event: 'etl.sync.start',
      syncId,
      catalog: options.catalog,
      enrichmentJobs: options.enrichmentJobs,
    },
    'ETL sync started',
  )

  const statuses: IngestionRunStatus[] = []
  let fatalError: string | null = null

  try {
    if (options.catalog) {
      const catalogStatus = await runScryfallImport(pool, logger, options, {
        syncId,
      })
      statuses.push(catalogStatus)

      if (!jobOk(catalogStatus) && options.enrichmentJobs.length > 0) {
        logger.warn(
          { event: 'etl.sync.skip_enrichment', syncId, catalogStatus },
          'Catalog job did not succeed — skipping enrichment',
        )
        const status = rollupSyncStatus(statuses)
        await finishEtlSync(pool, { syncId, status })
        return status
      }
    }

    for (const job of options.enrichmentJobs) {
      if (job === 'identifiers') {
        const status = await runMtgjsonImport(pool, logger, options, { syncId })
        statuses.push(status)
      } else {
        throw new Error(`Unknown enrichment job: ${job}`)
      }
    }
  } catch (err) {
    fatalError = err instanceof Error ? err.message : String(err)
    logger.error(
      { event: 'etl.sync.failed', syncId, err: fatalError },
      'ETL sync failed',
    )
    const status = statuses.length
      ? rollupSyncStatus([...statuses, 'failed'])
      : 'failed'
    await finishEtlSync(pool, {
      syncId,
      status,
      errorMessage: fatalError,
    })
    throw err
  }

  const status = rollupSyncStatus(statuses)
  await finishEtlSync(pool, { syncId, status })
  logger.info({ event: 'etl.sync.complete', syncId, status }, 'ETL sync finished')
  return status
}

export function parseEnrichmentJobs(raw: string | string[] | undefined): EnrichmentJobId[] {
  if (raw === undefined) return []
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)

  const jobs: EnrichmentJobId[] = []
  for (const part of parts) {
    if (part === 'identifiers') {
      if (!jobs.includes('identifiers')) jobs.push('identifiers')
    } else {
      throw new Error(
        `Unknown enrichment job "${part}". Expected: ${ENRICHMENT_JOB_IDS.join(', ')}`,
      )
    }
  }
  return jobs
}
