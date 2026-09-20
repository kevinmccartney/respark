import type { Pool } from 'pg';
import type { IngestionRunStatus } from 'schemas/etl-sync';
import { resolveStoreRaw } from '../../core/flags';
import { payloadHash } from '../../core/hashing';
import type { Logger } from '../../core/logger';
import { ProgressBar, tapByteStream } from '../../core/progress';
import { emitSyncEvent } from '../../core/stream-events';
import { isNonPlayableTypeLine } from '../../core/typeLine';
import type { GlobalFlags, JobContext } from '../../core/types';
import { finishJobRun, insertIngestionError, startJobRun } from '../../repositories/ingestionRuns';
import {
  reconcileMtgjsonCard,
  resolvePrinting,
  type UnmatchedRecord,
} from '../../repositories/mtgjsonReconcile';
import {
  replaceUnmatchedRecords,
  upsertIngestionReconciliation,
} from '../../repositories/reconciliation';
import { upsertMtgjsonCards, type RawMtgjsonUpsert } from '../../repositories/rawMtgjson';
import { buildDemoUnmatchedItems, installDemoAmbiguousClone } from './demoMismatches';
import { fetchMtgjsonMeta, openAllIdentifiersDownload } from './client';
import { mtgjsonCardSchema } from './schema';
import { streamAllIdentifiers } from './stream';
import { extractEnrichment } from './transformer';

const SOURCE = 'identifiers';
const STAGE = 'enrichment';
const JOB = 'identifiers';
const DEFAULT_BATCH_SIZE = 500;

type BatchItem = {
  raw: RawMtgjsonUpsert;
  enrichment: ReturnType<typeof extractEnrichment>;
};

export type MtgjsonImportStats = {
  matched: number;
  unmatched: number;
  ambiguous: number;
  identifiersAdded: number;
  rawInserted: number;
  rawUpdated: number;
  rawUnchanged: number;
};

/**
 * Download MTGJSON AllIdentifiers → raw.mtgjson_card + enrich catalog identifiers.
 * Never inserts catalog.printing rows.
 */
export const runMtgjsonImport = async (
  pool: Pool,
  logger: Logger,
  flags: GlobalFlags,
  ctx: JobContext,
): Promise<IngestionRunStatus> => {
  const storeRaw = resolveStoreRaw(flags);
  const batchSize = Number.parseInt(process.env.ETL_BATCH_SIZE ?? '', 10) || DEFAULT_BATCH_SIZE;

  const started = Date.now();
  const meta = await fetchMtgjsonMeta(logger);

  const runId = await startJobRun(pool, {
    syncId: ctx.syncId,
    stage: STAGE,
    job: JOB,
    sourceVersion: meta.version,
    sourceUrl: meta.downloadUrl,
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
  let recordsFailed = 0;
  let downloadBytes: number | null = null;
  let bytesRead = 0;
  let batch: BatchItem[] = [];

  const stats: MtgjsonImportStats = {
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    identifiersAdded: 0,
    rawInserted: 0,
    rawUpdated: 0,
    rawUnchanged: 0,
  };
  const unmatchedSamples: UnmatchedRecord[] = [];
  const MAX_UNMATCHED_SAMPLES = 5_000;

  // Catalog accounting for ops.etl_job_run:
  // inserted = identifiers newly written, updated = matched printings, unchanged unused
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let recordsUnchanged = 0;

  const useCardProgress = flags.limit !== undefined;
  const progress = new ProgressBar(
    'MTGJSON',
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

  const emitUnmatched = (row: UnmatchedRecord) => {
    emitSyncEvent(ctx.onEvent, {
      type: 'job.unmatched',
      syncId: ctx.syncId,
      jobRunId: runId,
      unmatched: {
        externalId: row.mtgjsonUuid,
        name: row.name,
        setCode: row.setCode,
        collectorNumber: row.collectorNumber,
        language: row.language,
        scryfallId: row.scryfallId,
        reason: row.reason,
      },
    });
  };

  const snapshot = () => ({
    current: useCardProgress ? recordsSeen : bytesRead,
    total: useCardProgress ? (flags.limit ?? null) : downloadBytes,
    cards: recordsSeen,
    inserted: stats.matched,
    updated: stats.identifiersAdded,
    unchanged: stats.unmatched,
    failed: recordsFailed + stats.ambiguous,
  });

  const flush = async () => {
    if (batch.length === 0) return;
    if (flags.dryRun) {
      const client = await pool.connect();
      try {
        for (const item of batch) {
          const result = await resolvePrinting(client, item.enrichment);
          if (result.status === 'matched') stats.matched += 1;
          else if (result.status === 'ambiguous') stats.ambiguous += 1;
          else {
            stats.unmatched += 1;
            if (unmatchedSamples.length < MAX_UNMATCHED_SAMPLES) {
              const row = {
                mtgjsonUuid: item.enrichment.mtgjsonUuid,
                name: item.enrichment.name,
                setCode: item.enrichment.setCode,
                collectorNumber: item.enrichment.collectorNumber,
                language: item.enrichment.language,
                scryfallId: item.enrichment.scryfallId,
                reason: result.reason,
              };
              unmatchedSamples.push(row);
              emitUnmatched(row);
            }
          }
        }
      } finally {
        client.release();
        batch = [];
        progress.update(snapshot(), true);
      }
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');

      if (storeRaw) {
        const rawResult = await upsertMtgjsonCards(
          client,
          batch.map((item) => item.raw),
        );
        stats.rawInserted += rawResult.inserted;
        stats.rawUpdated += rawResult.updated;
        stats.rawUnchanged += rawResult.unchanged;
      }

      for (const item of batch) {
        const result = await reconcileMtgjsonCard(client, item.enrichment);
        if (result.status === 'matched') {
          stats.matched += 1;
          stats.identifiersAdded += result.identifiersAdded;
          if (result.identifiersAdded > 0) {
            recordsInserted += result.identifiersAdded;
            recordsUpdated += 1;
          } else {
            recordsUnchanged += 1;
          }
        } else if (result.status === 'ambiguous') {
          stats.ambiguous += 1;
          await insertIngestionError(client, {
            runId,
            source: SOURCE,
            externalId: item.enrichment.mtgjsonUuid,
            stage: 'reconcile',
            errorMessage: result.reason,
            payload: {
              name: item.enrichment.name,
              setCode: item.enrichment.setCode,
              number: item.enrichment.collectorNumber,
              scryfallId: item.enrichment.scryfallId,
            },
          });
          emitSyncEvent(ctx.onEvent, {
            type: 'job.error',
            syncId: ctx.syncId,
            jobRunId: runId,
            error: {
              source: SOURCE,
              externalId: item.enrichment.mtgjsonUuid,
              stage: 'reconcile',
              errorMessage: result.reason,
              payload: {
                name: item.enrichment.name,
                setCode: item.enrichment.setCode,
                number: item.enrichment.collectorNumber,
                scryfallId: item.enrichment.scryfallId,
              },
            },
          });
        } else {
          stats.unmatched += 1;
          if (unmatchedSamples.length < MAX_UNMATCHED_SAMPLES) {
            const row = {
              mtgjsonUuid: item.enrichment.mtgjsonUuid,
              name: item.enrichment.name,
              setCode: item.enrichment.setCode,
              collectorNumber: item.enrichment.collectorNumber,
              language: item.enrichment.language,
              scryfallId: item.enrichment.scryfallId,
              reason: result.reason,
            };
            unmatchedSamples.push(row);
            emitUnmatched(row);
          }
        }
      }

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
      batch = [];
      progress.update(snapshot(), true);
    }
  };

  try {
    if (flags.demoMismatches) {
      logger.warn(
        { event: 'mtgjson.demo_mismatches' },
        'Demo mode: injecting synthetic unmatched/ambiguous records (no download)',
      );

      const unmatchedItems = buildDemoUnmatchedItems();
      batch.push(...unmatchedItems);
      recordsSeen += unmatchedItems.length;
      await flush();

      // Clone a real printing so set+number resolution hits ambiguous, then remove clone.
      const setupClient = await pool.connect();
      let ambiguousCleanup: (() => Promise<void>) | null = null;
      try {
        const installed = await installDemoAmbiguousClone(setupClient);
        if (installed) {
          ambiguousCleanup = installed.cleanup;
          batch.push(installed.item);
          recordsSeen += 1;
          await flush();
        } else {
          logger.warn(
            { event: 'mtgjson.demo_mismatches.skip_ambiguous' },
            'No catalog.printing seed row available for ambiguous demo',
          );
        }
      } finally {
        if (ambiguousCleanup) {
          try {
            await ambiguousCleanup();
          } catch (cleanupErr) {
            logger.warn(
              {
                event: 'mtgjson.demo_mismatches.cleanup_failed',
                err: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
              },
              'Failed to remove demo ambiguous clone printing',
            );
          }
        }
        setupClient.release();
      }

      progress.done(snapshot());
    } else {
      const { body, contentLength } = await openAllIdentifiersDownload(meta, logger);
      downloadBytes = contentLength;

      const trackedBody = tapByteStream(body, (total) => {
        bytesRead = total;
        progress.update(snapshot());
      });

      for await (const { key, value } of streamAllIdentifiers(trackedBody)) {
        if (flags.limit !== undefined && recordsSeen >= flags.limit) break;

        recordsSeen += 1;
        const parsed = mtgjsonCardSchema.safeParse(value);
        if (!parsed.success) {
          recordsFailed += 1;
          await insertIngestionError(pool, {
            runId,
            source: SOURCE,
            externalId: key,
            stage: 'validate',
            errorMessage: parsed.error.message,
            payload: value,
          });
          emitSyncEvent(ctx.onEvent, {
            type: 'job.error',
            syncId: ctx.syncId,
            jobRunId: runId,
            error: {
              source: SOURCE,
              externalId: key,
              stage: 'validate',
              errorMessage: parsed.error.message,
              payload: value,
            },
          });
          continue;
        }

        const card = parsed.data;
        // Prefer object uuid; fall back to map key
        if (!card.uuid) {
          (card as { uuid: string }).uuid = key;
        }

        if (isNonPlayableTypeLine(card.type)) {
          continue;
        }

        const enrichment = extractEnrichment(card);
        batch.push({
          raw: {
            mtgjsonUuid: enrichment.mtgjsonUuid,
            scryfallId: enrichment.scryfallId,
            payload: value,
            payloadHash: payloadHash(value),
          },
          enrichment,
        });

        if (batch.length >= batchSize) {
          await flush();
          logger.debug(
            {
              event: 'mtgjson.batch',
              seen: recordsSeen,
              matched: stats.matched,
              unmatched: stats.unmatched,
              ambiguous: stats.ambiguous,
            },
            'Flushed MTGJSON batch',
          );
        }
      }

      await flush();
      progress.done(snapshot());
    }

    const reconciliation = {
      source: SOURCE,
      sourceVersion: meta.version,
      runId,
      recordsProcessed: recordsSeen,
      matched: stats.matched,
      unmatched: stats.unmatched,
      ambiguous: stats.ambiguous,
      identifiersAdded: stats.identifiersAdded,
      demoMismatches: Boolean(flags.demoMismatches),
      raw: {
        inserted: stats.rawInserted,
        updated: stats.rawUpdated,
        unchanged: stats.rawUnchanged,
        storeRaw,
      },
      durationMs: Date.now() - started,
      dryRun: flags.dryRun,
      limit: flags.limit ?? null,
    };

    await upsertIngestionReconciliation(pool, {
      runId,
      matched: stats.matched,
      unmatched: stats.unmatched,
      ambiguous: stats.ambiguous,
      identifiersAdded: stats.identifiersAdded,
      rawInserted: stats.rawInserted,
      rawUpdated: stats.rawUpdated,
      rawUnchanged: stats.rawUnchanged,
      storeRaw,
      demoMismatches: Boolean(flags.demoMismatches),
      dryRun: flags.dryRun,
      limitN: flags.limit ?? null,
    });
    await replaceUnmatchedRecords(pool, runId, unmatchedSamples);

    const status =
      recordsFailed > 0 && stats.matched === 0 && stats.ambiguous === 0 && stats.unmatched === 0
        ? 'failed'
        : recordsFailed > 0 || stats.ambiguous > 0 || stats.unmatched > 0
          ? 'partial_success'
          : 'success';

    await finishJobRun(pool, {
      runId,
      status,
      recordsSeen,
      recordsInserted,
      recordsUpdated,
      recordsUnchanged,
      recordsFailed: recordsFailed + stats.unmatched + stats.ambiguous,
      downloadBytes,
      durationMs: Date.now() - started,
    });

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
        recordsFailed: recordsFailed + stats.unmatched + stats.ambiguous,
        downloadBytes,
        durationMs: Date.now() - started,
      },
      completedAt: new Date().toISOString(),
      errorMessage: null,
    });

    logger.info(
      {
        event: 'mtgjson.complete',
        status,
        ...reconciliation,
        unmatchedSampleSize: unmatchedSamples.length,
      },
      'MTGJSON import finished (raw + identifier enrichment)',
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
      recordsFailed: recordsFailed + stats.unmatched + stats.ambiguous,
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
        recordsFailed: recordsFailed + stats.unmatched + stats.ambiguous,
        downloadBytes,
        durationMs: Date.now() - started,
      },
      completedAt: new Date().toISOString(),
      errorMessage: message,
    });
    throw err;
  }
};
