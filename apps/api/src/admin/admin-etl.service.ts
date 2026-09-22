import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createLogger, runEtlSync } from 'etl';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Pool } from 'pg';

import type { EnrichmentJobId } from '@respark/schemas/etl-sync';


import { DATABASE, DATABASE_POOL, type Database } from '../db/database.module';
import { etlSyncs } from '../db/schema';

import { EtlSyncEventsService } from './etl-sync-events.service';

export type StartSyncInput = {
  catalog: boolean;
  enrichmentJobs: EnrichmentJobId[];
};

@Injectable()
export class AdminEtlService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
    private readonly events: EtlSyncEventsService,
    @InjectPinoLogger(AdminEtlService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Start an ETL sync in-process via the etl lib. Returns immediately (202);
   * progress streams over the WebSocket via EtlSyncEventsService.
   */
  async startSync(
    input: StartSyncInput,
  ): Promise<{ accepted: true; catalog: boolean; enrichmentJobs: string[] }> {
    if (!input.catalog && input.enrichmentJobs.length === 0) {
      throw new BadRequestException('At least one of catalog or enrichmentJobs is required');
    }

    const [running] = await this.db
      .select({ id: etlSyncs.id })
      .from(etlSyncs)
      .where(eq(etlSyncs.status, 'running'))
      .limit(1);

    if (running) {
      throw new ConflictException(
        `An ETL sync is already in progress (${running.id}). Wait for it to finish.`,
      );
    }

    this.logger.info(
      {
        event: 'admin.etl_sync.start',
        catalog: input.catalog,
        enrichmentJobs: input.enrichmentJobs,
      },
      'Starting ETL sync in-process',
    );

    void this.runSync(input).catch((err) => {
      this.logger.error(
        {
          event: 'admin.etl_sync.failed',
          err: err instanceof Error ? err.message : String(err),
        },
        'Background ETL sync failed',
      );
    });

    return {
      accepted: true,
      catalog: input.catalog,
      enrichmentJobs: input.enrichmentJobs,
    };
  }

  private async runSync(input: StartSyncInput): Promise<void> {
    const logger = createLogger(false);
    await runEtlSync(
      this.pool,
      logger,
      {
        catalog: input.catalog,
        enrichmentJobs: input.enrichmentJobs,
        dryRun: false,
        verbose: false,
      },
      {
        onEvent: (event) => this.events.publish(event),
      },
    );
  }
}
