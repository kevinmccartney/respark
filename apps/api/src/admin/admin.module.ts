import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminEtlService } from './admin-etl.service';
import { AdminService } from './admin.service';
import { EtlSyncEventsService } from './etl-sync-events.service';
import { EtlSyncGateway } from './etl-sync.gateway';
import { EtlSyncNotifyListener } from './etl-sync-notify.listener';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminEtlService,
    EtlSyncEventsService,
    EtlSyncGateway,
    EtlSyncNotifyListener,
  ],
})
export class AdminModule {}
