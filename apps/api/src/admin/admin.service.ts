import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DATABASE, type Database } from "../db/database.module";
import {
  ingestionErrors,
  ingestionRuns,
  type IngestionErrorRow,
  type IngestionRunRow,
} from "../db/schema";
import type { IngestionError, IngestionRun } from "./admin.types";

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(AdminService.name)
    private readonly logger: PinoLogger,
  ) {}

  async listIngestionRuns(input: {
    limit: number;
    source?: string;
    status?: string;
  }): Promise<IngestionRun[]> {
    const filters: SQL[] = [];
    if (input.source) filters.push(eq(ingestionRuns.source, input.source));
    if (input.status) filters.push(eq(ingestionRuns.status, input.status));

    const rows = await this.db
      .select()
      .from(ingestionRuns)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(ingestionRuns.startedAt))
      .limit(input.limit);

    this.logger.info(
      {
        event: "admin.ingestion_runs.list",
        limit: input.limit,
        source: input.source ?? null,
        status: input.status ?? null,
        count: rows.length,
      },
      "Listed ingestion runs",
    );

    return rows.map(toIngestionRun);
  }

  async getIngestionRun(id: string): Promise<IngestionRun> {
    const [row] = await this.db
      .select()
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Ingestion run ${id} not found`);
    }

    return toIngestionRun(row);
  }

  async listIngestionErrors(
    runId: string,
    input: { limit: number; offset: number },
  ): Promise<{ errors: IngestionError[]; total: number }> {
    // Ensure the run exists before listing errors (clearer than an empty page).
    await this.getIngestionRun(runId);

    const where = eq(ingestionErrors.runId, runId);

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(ingestionErrors)
      .where(where);

    const rows = await this.db
      .select()
      .from(ingestionErrors)
      .where(where)
      .orderBy(desc(ingestionErrors.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    this.logger.info(
      {
        event: "admin.ingestion_errors.list",
        runId,
        limit: input.limit,
        offset: input.offset,
        total: totalRow.total,
        count: rows.length,
      },
      "Listed ingestion errors",
    );

    return {
      errors: rows.map(toIngestionError),
      total: totalRow.total,
    };
  }
}

function toIngestionRun(row: IngestionRunRow): IngestionRun {
  return {
    id: row.id,
    source: row.source,
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
