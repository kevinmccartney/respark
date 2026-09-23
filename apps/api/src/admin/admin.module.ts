import { Module } from '@nestjs/common';

import { RecommendationsModule } from '../recommendations/recommendations.module';

import { AdminEtlService } from './admin-etl.service';
import { AdminUsersService } from './admin-users.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EtlSyncEventsService } from './etl-sync-events.service';
import { EtlSyncNotifyListener } from './etl-sync-notify.listener';
import { EtlSyncGateway } from './etl-sync.gateway';

@Module({
  imports: [RecommendationsModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminEtlService,
    AdminUsersService,
    EtlSyncEventsService,
    EtlSyncGateway,
    EtlSyncNotifyListener,
  ],
})
export class AdminModule {}
