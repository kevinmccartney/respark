import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminEtlService } from './admin-etl.service'
import { AdminService } from './admin.service'

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminEtlService],
})
export class AdminModule {}
