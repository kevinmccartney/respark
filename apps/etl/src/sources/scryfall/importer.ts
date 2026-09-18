import type { Pool } from 'pg'
import { payloadHash } from '../../core/hashing.js'
import type { Logger } from '../../core/logger.js'
import type { GlobalFlags } from '../../core/types.js'
import {
  finishIngestionRun,
  insertIngestionError,
  startIngestionRun,
} from '../../repositories/ingestionRuns.js'
import { upsertScryfallCards, type RawScryfallUpsert } from '../../repositories/rawScryfall.js'
import {
  fetchBulkMetadata,
  openBulkDownload,
  selectBulkDataset,
} from './client.js'
import { bulkByteSize, bulkDownloadUri, scryfallCardSchema } from './schema.js'
import { streamJsonlGzip } from './stream.js'

const SOURCE = 'scryfall'
const DEFAULT_BATCH_SIZE = 500

export type ScryfallImportOptions = GlobalFlags & {
  batchSize?: number
  /** When false, skip writes to raw.scryfall_card (still validates + records the run). */
  storeRaw: boolean
}

function resolveStoreRaw(flags: GlobalFlags): boolean {
  if (flags.storeRaw !== undefined) return flags.storeRaw
  if (process.env.ETL_STORE_RAW === 'false') return false
  return true
}

function parseSourceUpdatedAt(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    // Scryfall sometimes uses unix seconds
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Phase 2: download Scryfall bulk data, validate, stage into raw.scryfall_card.
 * Does not write catalog.* (Phase 3).
 */
export async function runScryfallImport(
  pool: Pool,
  logger: Logger,
  flags: GlobalFlags,
): Promise<void> {
  const options: ScryfallImportOptions = {
    ...flags,
    storeRaw: resolveStoreRaw(flags),
    batchSize: Number.parseInt(process.env.ETL_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE,
  }

  const started = Date.now()
  const meta = await fetchBulkMetadata(logger)
  const dataset = selectBulkDataset(meta)

  const runId = await startIngestionRun(pool, {
    source: SOURCE,
    sourceVersion: dataset.updated_at,
    sourceUrl: bulkDownloadUri(dataset),
  })

  let recordsSeen = 0
  let recordsInserted = 0
  let recordsUpdated = 0
  let recordsUnchanged = 0
  let recordsFailed = 0
  let downloadBytes = bulkByteSize(dataset)
  let batch: RawScryfallUpsert[] = []

  const flush = async () => {
    if (batch.length === 0) return
    if (options.dryRun || !options.storeRaw) {
      batch = []
      return
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      const result = await upsertScryfallCards(client, batch)
      await client.query('commit')
      recordsInserted += result.inserted
      recordsUpdated += result.updated
      recordsUnchanged += result.unchanged
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
      batch = []
    }
  }

  try {
    const { body, contentLength } = await openBulkDownload(dataset, logger)
    if (contentLength !== null) downloadBytes = contentLength

    for await (const raw of streamJsonlGzip(body)) {
      if (options.limit !== undefined && recordsSeen >= options.limit) {
        break
      }

      recordsSeen += 1
      const parsed = scryfallCardSchema.safeParse(raw)
      if (!parsed.success) {
        recordsFailed += 1
        await insertIngestionError(pool, {
          runId,
          source: SOURCE,
          externalId:
            typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : null,
          stage: 'validate',
          errorMessage: parsed.error.message,
          payload: raw,
        })
        continue
      }

      const card = parsed.data
      batch.push({
        scryfallId: card.id,
        oracleId: card.oracle_id ?? null,
        payload: raw,
        sourceUpdatedAt: parseSourceUpdatedAt(card.updated_at),
        payloadHash: payloadHash(raw),
      })

      if (batch.length >= (options.batchSize ?? DEFAULT_BATCH_SIZE)) {
        await flush()
        logger.debug(
          {
            event: 'scryfall.batch',
            seen: recordsSeen,
            inserted: recordsInserted,
            updated: recordsUpdated,
            unchanged: recordsUnchanged,
            failed: recordsFailed,
          },
          'Flushed Scryfall batch',
        )
      }
    }

    await flush()

    const status =
      recordsFailed > 0 && recordsSeen > recordsFailed
        ? 'partial_success'
        : recordsFailed > 0 && recordsInserted + recordsUpdated + recordsUnchanged === 0
          ? 'failed'
          : 'success'

    await finishIngestionRun(pool, {
      runId,
      status,
      recordsSeen,
      recordsInserted,
      recordsUpdated,
      recordsUnchanged,
      recordsFailed,
      downloadBytes,
      durationMs: Date.now() - started,
    })

    logger.info(
      {
        event: 'scryfall.complete',
        runId,
        status,
        recordsSeen,
        recordsInserted,
        recordsUpdated,
        recordsUnchanged,
        recordsFailed,
        downloadBytes,
        durationMs: Date.now() - started,
        dryRun: options.dryRun,
        storeRaw: options.storeRaw,
        limit: options.limit,
        bulkType: dataset.type,
      },
      'Scryfall raw import finished',
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await finishIngestionRun(pool, {
      runId,
      status: 'failed',
      recordsSeen,
      recordsInserted,
      recordsUpdated,
      recordsUnchanged,
      recordsFailed,
      downloadBytes,
      durationMs: Date.now() - started,
      errorMessage: message,
    })
    throw err
  }
}
