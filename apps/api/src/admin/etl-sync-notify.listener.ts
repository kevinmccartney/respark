import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Pool, PoolClient } from 'pg';
import type { SyncEvent } from 'etl';
import { DATABASE_POOL } from '../db/database.module';
import { EtlSyncEventsService } from './etl-sync-events.service';

const CHANNEL = 'etl_sync';

/**
 * LISTEN for ops.etl_sync changes so CLI (report-mode) syncs still refresh the admin list.
 */
@Injectable()
export class EtlSyncNotifyListener implements OnModuleInit, OnModuleDestroy {
  private client: PoolClient | null = null;

  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool,
    private readonly events: EtlSyncEventsService,
    @InjectPinoLogger(EtlSyncNotifyListener.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit() {
    try {
      this.client = await this.pool.connect();
      await this.client.query(`LISTEN ${CHANNEL}`);
      this.client.on('notification', (msg) => {
        if (msg.channel !== CHANNEL || !msg.payload) return;
        try {
          const event = JSON.parse(msg.payload) as SyncEvent;
          this.events.publish(event);
        } catch (err) {
          this.logger.warn(
            { event: 'admin.etl_sync.notify_parse_failed', err, payload: msg.payload },
            'Failed to parse etl_sync NOTIFY payload',
          );
        }
      });
      this.logger.info(
        { event: 'admin.etl_sync.notify_listening', channel: CHANNEL },
        'Listening for etl_sync notifications',
      );
    } catch (err) {
      this.logger.error(
        { event: 'admin.etl_sync.notify_listen_failed', err },
        'Could not LISTEN on etl_sync channel',
      );
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      await this.client.query(`UNLISTEN ${CHANNEL}`);
    } catch {
      // ignore
    }
    this.client.release();
    this.client = null;
  }
}
