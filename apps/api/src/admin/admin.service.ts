import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DATABASE, type Database } from '../db/database.module';
import {
  etlJobRuns,
  etlSyncs,
  ingestionErrors,
  ingestionReconciliations,
  ingestionUnmatched,
  type EtlJobRunRow,
  type EtlSyncRow,
  type IngestionErrorRow,
  type IngestionReconciliationRow,
  type IngestionUnmatchedRow,
} from '../db/schema';
import type {
  EtlJobRun,
  EtlSync,
  IngestionError,
  IngestionReconciliation,
  IngestionUnmatched,
} from './admin.types';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(AdminService.name)
    private readonly logger: PinoLogger,
  ) {}

  async listEtlSyncs(input: { limit: number; status?: string }): Promise<EtlSync[]> {
    const filters: SQL[] = [];
    if (input.status) filters.push(eq(etlSyncs.status, input.status));

    const syncRows = await this.db
      .select()
      .from(etlSyncs)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(etlSyncs.startedAt))
      .limit(input.limit);

    const syncIds = syncRows.map((s) => s.id);
    const jobsBySync = new Map<string, EtlJobRunRow[]>();

    if (syncIds.length > 0) {
      const jobRows = await this.db
        .select()
        .from(etlJobRuns)
        .where(inArray(etlJobRuns.syncId, syncIds))
        .orderBy(asc(etlJobRuns.startedAt));

      for (const job of jobRows) {
        const list = jobsBySync.get(job.syncId) ?? [];
        list.push(job);
        jobsBySync.set(job.syncId, list);
      }
    }

    this.logger.info(
      {
        event: 'admin.etl_syncs.list',
        limit: input.limit,
        status: input.status ?? null,
        count: syncRows.length,
      },
      'Listed ETL syncs',
    );

    return syncRows.map((row) => toEtlSync(row, jobsBySync.get(row.id) ?? []));
  }

  async getEtlSync(id: string): Promise<EtlSync> {
    const [row] = await this.db.select().from(etlSyncs).where(eq(etlSyncs.id, id)).limit(1);

    if (!row) {
      throw new NotFoundException(`ETL sync ${id} not found`);
    }

    const jobs = await this.db
      .select()
      .from(etlJobRuns)
      .where(eq(etlJobRuns.syncId, id))
      .orderBy(asc(etlJobRuns.startedAt));

    return toEtlSync(row, jobs);
  }

  async getJobRun(syncId: string, jobRunId: string): Promise<EtlJobRun> {
    const [row] = await this.db
      .select()
      .from(etlJobRuns)
      .where(and(eq(etlJobRuns.id, jobRunId), eq(etlJobRuns.syncId, syncId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Job run ${jobRunId} not found for sync ${syncId}`);
    }

    return toEtlJobRun(row);
  }

  async listJobErrors(
    syncId: string,
    jobRunId: string,
    input: { limit: number; offset: number },
  ): Promise<{ errors: IngestionError[]; total: number }> {
    await this.getJobRun(syncId, jobRunId);

    const where = eq(ingestionErrors.runId, jobRunId);

    const [totalRow] = await this.db.select({ total: count() }).from(ingestionErrors).where(where);

    const rows = await this.db
      .select()
      .from(ingestionErrors)
      .where(where)
      .orderBy(desc(ingestionErrors.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    this.logger.info(
      {
        event: 'admin.etl_job_errors.list',
        syncId,
        jobRunId,
        limit: input.limit,
        offset: input.offset,
        total: totalRow.total,
        count: rows.length,
      },
      'Listed job errors',
    );

    return {
      errors: rows.map(toIngestionError),
      total: totalRow.total,
    };
  }

  async getJobReconciliation(
    syncId: string,
    jobRunId: string,
  ): Promise<IngestionReconciliation | null> {
    const job = await this.getJobRun(syncId, jobRunId);
    if (job.job !== 'identifiers') {
      return null;
    }

    const [row] = await this.db
      .select()
      .from(ingestionReconciliations)
      .where(eq(ingestionReconciliations.runId, jobRunId))
      .limit(1);

    this.logger.info(
      {
        event: 'admin.etl_job_reconciliation.get',
        syncId,
        jobRunId,
        found: Boolean(row),
      },
      'Fetched job reconciliation',
    );

    return row ? toIngestionReconciliation(row) : null;
  }

  async listJobUnmatched(
    syncId: string,
    jobRunId: string,
    input: { limit: number; offset: number },
  ): Promise<{ unmatched: IngestionUnmatched[]; total: number }> {
    const job = await this.getJobRun(syncId, jobRunId);
    if (job.job !== 'identifiers') {
      return { unmatched: [], total: 0 };
    }

    const where = eq(ingestionUnmatched.runId, jobRunId);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(ingestionUnmatched)
      .where(where);

    const rows = await this.db
      .select()
      .from(ingestionUnmatched)
      .where(where)
      .orderBy(asc(ingestionUnmatched.id))
      .limit(input.limit)
      .offset(input.offset);

    this.logger.info(
      {
        event: 'admin.etl_job_unmatched.list',
        syncId,
        jobRunId,
        limit: input.limit,
        offset: input.offset,
        total: totalRow.total,
        count: rows.length,
      },
      'Listed job unmatched records',
    );

    return {
      unmatched: rows.map(toIngestionUnmatched),
      total: totalRow.total,
    };
  }
}

function toEtlSync(row: EtlSyncRow, jobs: EtlJobRunRow[]): EtlSync {
  const stageOrder = ['catalog', 'enrichment'];
  const byStage = new Map<string, EtlJobRun[]>();
  for (const job of jobs) {
    const list = byStage.get(job.stage) ?? [];
    list.push(toEtlJobRun(job));
    byStage.set(job.stage, list);
  }

  const stages = stageOrder
    .filter((s) => byStage.has(s))
    .map((stage) => ({ stage, jobs: byStage.get(stage)! }));

  // Include any unexpected stages
  for (const [stage, stageJobs] of byStage) {
    if (!stageOrder.includes(stage)) {
      stages.push({ stage, jobs: stageJobs });
    }
  }

  return {
    id: row.id,
    status: row.status,
    includeCatalog: row.includeCatalog,
    includeEnrichment: row.includeEnrichment,
    enrichmentJobs: row.enrichmentJobs ?? [],
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    stages,
  };
}

function toEtlJobRun(row: EtlJobRunRow): EtlJobRun {
  return {
    id: row.id,
    syncId: row.syncId,
    stage: row.stage,
    job: row.job,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    sourceVersion: row.sourceVersion,
    sourceUrl: row.sourceUrl,
    recordsSeen: row.recordsSeen,
    recordsInserted: row.recordsInserted,
    recordsUpdated: row.recordsUpdated,
    recordsUnchanged: row.recordsUnchanged,
    recordsFailed: row.recordsFailed,
    downloadBytes: row.downloadBytes,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
  };
}

function toIngestionError(row: IngestionErrorRow): IngestionError {
  return {
    id: row.id,
    runId: row.runId,
    source: row.source,
    externalId: row.externalId,
    stage: row.stage,
    errorMessage: row.errorMessage,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
  };
}

function toIngestionReconciliation(row: IngestionReconciliationRow): IngestionReconciliation {
  return {
    runId: row.runId,
    matched: row.matched,
    unmatched: row.unmatched,
    ambiguous: row.ambiguous,
    identifiersAdded: row.identifiersAdded,
    rawInserted: row.rawInserted,
    rawUpdated: row.rawUpdated,
    rawUnchanged: row.rawUnchanged,
    storeRaw: row.storeRaw,
    demoMismatches: row.demoMismatches,
    dryRun: row.dryRun,
    limitN: row.limitN,
    createdAt: row.createdAt.toISOString(),
  };
}

function toIngestionUnmatched(row: IngestionUnmatchedRow): IngestionUnmatched {
  return {
    id: row.id,
    runId: row.runId,
    externalId: row.externalId,
    name: row.name,
    setCode: row.setCode,
    collectorNumber: row.collectorNumber,
    language: row.language,
    scryfallId: row.scryfallId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}
