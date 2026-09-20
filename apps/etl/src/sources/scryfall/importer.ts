import type { Pool } from 'pg';
import type { IngestionRunStatus } from 'schemas/etl-sync';
import { resolveStoreRaw } from '../../core/flags';
import { payloadHash } from '../../core/hashing';
import type { Logger } from '../../core/logger';
import { ProgressBar, tapByteStream } from '../../core/progress';
import { emitSyncEvent } from '../../core/stream-events';
import { isCatalogExtra } from '../../core/catalogSkip';
import type { GlobalFlags, JobContext } from '../../core/types';
import { upsertCatalogRecords } from '../../repositories/catalog';
import { finishJobRun, insertIngestionError, startJobRun } from '../../repositories/ingestionRuns';
import { upsertScryfallCards, type RawScryfallUpsert } from '../../repositories/rawScryfall';
import { fetchBulkMetadata, openBulkDownload, selectBulkDataset } from './client';
import { bulkByteSize, bulkDownloadUri, scryfallCardSchema } from './schema';
import { streamJsonlGzip } from './stream';
import { transformScryfallCard, type CanonicalRecord } from './transformer';

const SOURCE = 'catalog';
const STAGE = 'catalog';
const JOB = 'catalog';
const DEFAULT_BATCH_SIZE = 500;

export type ScryfallImportOptions = GlobalFlags & {
  batchSize?: number;
  storeRaw: boolean;
};

type BatchItem = {
  raw: RawScryfallUpsert;
  canonical: CanonicalRecord | null;
};

const parseSourceUpdatedAt = (value: string | number | null | undefined): Date | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    // Scryfall sometimes uses unix seconds
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Download Scryfall bulk data → raw.scryfall_card + catalog.* (Phase 4 full import).
 */
export const runScryfallImport = async (
  pool: Pool,
  logger: Logger,
  flags: GlobalFlags,
  ctx: JobContext,
): Promise<IngestionRunStatus> => {
  const options: ScryfallImportOptions = {
    ...flags,
    storeRaw: resolveStoreRaw(flags),
    batchSize: Number.parseInt(process.env.ETL_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE,
  };

  const started = Date.now();
  const meta = await fetchBulkMetadata(logger);
  const dataset = selectBulkDataset(meta);

  const runId = await startJobRun(pool, {
    syncId: ctx.syncId,
    stage: STAGE,
    job: JOB,
    sourceVersion: dataset.updated_at,
    sourceUrl: bulkDownloadUri(dataset),
  });

  emitSyncEvent(ctx.onEvent, {
    type: 'job.started',
    syncId: ctx.syncId,
    jobRunId: runId,
    stage: STAGE,
    job: JOB,
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  let recordsSeen = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsUnchanged = 0;
  let recordsFailed = 0;
  let recordsSkipped = 0;
  let downloadBytes = bulkByteSize(dataset);
  let bytesRead = 0;
  let batch: BatchItem[] = [];

  const useCardProgress = options.limit !== undefined;
  const progress = new ProgressBar(
    'Scryfall',
    useCardProgress ? 'cards' : 'bytes',
    logger,
    process.stderr,
    (snap) => {
      emitSyncEvent(ctx.onEvent, {
        type: 'job.progress',
        syncId: ctx.syncId,
        jobRunId: runId,
        stage: STAGE,
        job: JOB,
        progress: {
          current: snap.current,
          total: snap.total,
          cards: snap.cards,
          inserted: snap.inserted,
          updated: snap.updated,
          unchanged: snap.unchanged,
          failed: snap.failed,
          percent: snap.percent,
        },
      });
    },
  );

  const snapshot = () => ({
    current: useCardProgress ? recordsSeen : bytesRead,
    total: useCardProgress ? (options.limit ?? null) : (downloadBytes ?? null),
    cards: recordsSeen,
    inserted: recordsInserted,
    updated: recordsUpdated,
    unchanged: recordsUnchanged,
    failed: recordsFailed,
  });

  const renderProgress = (force = false) => {
    progress.update(snapshot(), force);
  };

  const flush = async () => {
    if (batch.length === 0) return;
    if (options.dryRun) {
      batch = [];
      renderProgress();
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');

      if (options.storeRaw) {
        await upsertScryfallCards(
          client,
          batch.map((item) => item.raw),
        );
      }

      const canonicals = batch
        .map((item) => item.canonical)
        .filter((c): c is CanonicalRecord => c !== null);

      const catalogResult = await upsertCatalogRecords(client, canonicals);
      recordsInserted += catalogResult.inserted;
      recordsUpdated += catalogResult.updated;
      recordsUnchanged += catalogResult.unchanged;

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
      batch = [];
      renderProgress(true);
    }
  };

  try {
    const { body, contentLength } = await openBulkDownload(dataset, logger);
    if (contentLength !== null) downloadBytes = contentLength;

    const trackedBody = tapByteStream(body, (total) => {
      bytesRead = total;
      renderProgress();
    });

    for await (const record of streamJsonlGzip(trackedBody)) {
      if (options.limit !== undefined && recordsSeen >= options.limit) {
        break;
      }

      recordsSeen += 1;
      if (!record.ok) {
        recordsFailed += 1;
        await insertIngestionError(pool, {
          runId,
          source: SOURCE,
          externalId: null,
          stage: 'parse',
          errorMessage: record.error,
          payload: { line: record.line },
        });
        emitSyncEvent(ctx.onEvent, {
          type: 'job.error',
          syncId: ctx.syncId,
          jobRunId: runId,
          error: {
            source: SOURCE,
            externalId: null,
            stage: 'parse',
            errorMessage: record.error,
            payload: { line: record.line },
          },
        });
        continue;
      }

      const raw = record.value;
      const parsed = scryfallCardSchema.safeParse(raw);
      if (!parsed.success) {
        recordsFailed += 1;
        const externalId =
          typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : null;
        await insertIngestionError(pool, {
          runId,
          source: SOURCE,
          externalId,
          stage: 'validate',
          errorMessage: parsed.error.message,
          payload: raw,
        });
        emitSyncEvent(ctx.onEvent, {
          type: 'job.error',
          syncId: ctx.syncId,
          jobRunId: runId,
          error: {
            source: SOURCE,
            externalId,
            stage: 'validate',
            errorMessage: parsed.error.message,
            payload: raw,
          },
        });
        continue;
      }

      const card = parsed.data;
      if (
        isCatalogExtra({
          layout: card.layout,
          typeLine: card.type_line,
          setType: card.set_type,
        })
      ) {
        recordsSkipped += 1;
        continue;
      }

      const canonical = transformScryfallCard(card);
      if (!canonical) {
        recordsFailed += 1;
        await insertIngestionError(pool, {
          runId,
          source: SOURCE,
          externalId: card.id,
          stage: 'transform',
          errorMessage: 'Missing required fields for catalog (oracle_id / set / collector_number)',
          payload: raw,
        });
        emitSyncEvent(ctx.onEvent, {
          type: 'job.error',
          syncId: ctx.syncId,
          jobRunId: runId,
          error: {
            source: SOURCE,
            externalId: card.id,
            stage: 'transform',
            errorMessage:
              'Missing required fields for catalog (oracle_id / set / collector_number)',
            payload: raw,
          },
        });
        // Still stage raw when possible so we can debug later.
        if (!options.dryRun && options.storeRaw) {
          batch.push({
            raw: {
              scryfallId: card.id,
              oracleId: card.oracle_id ?? null,
              payload: raw,
              sourceUpdatedAt: parseSourceUpdatedAt(card.updated_at),
              payloadHash: payloadHash(raw),
            },
            canonical: null,
          });
        }
        continue;
      }

      batch.push({
        raw: {
          scryfallId: card.id,
          oracleId: card.oracle_id ?? null,
          payload: raw,
          sourceUpdatedAt: parseSourceUpdatedAt(card.updated_at),
          payloadHash: payloadHash(raw),
        },
        canonical,
      });

      if (batch.length >= (options.batchSize ?? DEFAULT_BATCH_SIZE)) {
        await flush();
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
        );
      }
    }

    await flush();
    progress.done(snapshot());

    const status =
      recordsFailed > 0 && recordsSeen > recordsFailed
        ? 'partial_success'
        : recordsFailed > 0 && recordsInserted + recordsUpdated + recordsUnchanged === 0
          ? 'failed'
          : 'success';

    await finishJobRun(pool, {
      runId,
      status,
      recordsSeen,
      recordsInserted,
      recordsUpdated,
      recordsUnchanged,
      recordsFailed,
      downloadBytes,
      durationMs: Date.now() - started,
    });

    const completedAt = new Date().toISOString();
    emitSyncEvent(ctx.onEvent, {
      type: 'job.completed',
      syncId: ctx.syncId,
      jobRunId: runId,
      stage: STAGE,
      job: JOB,
      status,
      metrics: {
        recordsSeen,
        recordsInserted,
        recordsUpdated,
        recordsUnchanged,
        recordsFailed,
        downloadBytes,
        durationMs: Date.now() - started,
      },
      completedAt,
      errorMessage: null,
    });

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
        recordsSkipped,
        downloadBytes,
        durationMs: Date.now() - started,
        dryRun: options.dryRun,
        storeRaw: options.storeRaw,
        limit: options.limit,
        bulkType: dataset.type,
      },
      'Scryfall import finished (raw + catalog)',
    );
    return status;
  } catch (err) {
    progress.done(snapshot());
    const message = err instanceof Error ? err.message : String(err);
    await finishJobRun(pool, {
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
    });
    emitSyncEvent(ctx.onEvent, {
      type: 'job.completed',
      syncId: ctx.syncId,
      jobRunId: runId,
      stage: STAGE,
      job: JOB,
      status: 'failed',
      metrics: {
        recordsSeen,
        recordsInserted,
        recordsUpdated,
        recordsUnchanged,
        recordsFailed,
        downloadBytes,
        durationMs: Date.now() - started,
      },
      completedAt: new Date().toISOString(),
      errorMessage: message,
    });
    throw err;
  }
};
