import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  SYNC_LOG_DEFAULT_LIMIT,
  adminListQuerySchema,
  startEtlSyncBodySchema,
  type AdminListQuery,
  type StartEtlSyncBody,
} from 'schemas/etl-sync';
import {
  createRecommendationDownweightBodySchema,
  type CreateRecommendationDownweightBody,
} from 'schemas/recommendations';
import { uuidSchema } from 'schemas/primitives';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { zodPipe } from '../lib/zod-pipe';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { AdminEtlService } from './admin-etl.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(ClerkAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminEtl: AdminEtlService,
    private readonly recommendations: RecommendationsService,
  ) {}

  @Post('etl-syncs')
  @HttpCode(202)
  async startEtlSync(@Body(zodPipe(startEtlSyncBodySchema)) body: StartEtlSyncBody) {
    return this.adminEtl.startSync(body);
  }

  @Get('etl-syncs')
  async listEtlSyncs(@Query(zodPipe(adminListQuerySchema)) query: AdminListQuery) {
    return {
      syncs: await this.adminService.listEtlSyncs({
        limit: query.limit ?? ADMIN_LIST_DEFAULT_LIMIT,
        status: query.status,
      }),
    };
  }

  @Get('etl-syncs/:id')
  async getEtlSync(@Param('id', zodPipe(uuidSchema)) id: string) {
    return {
      sync: await this.adminService.getEtlSync(id),
    };
  }

  @Get('etl-syncs/:id/logs')
  async listEtlSyncLogs(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Query(zodPipe(adminListQuerySchema)) query: AdminListQuery,
  ) {
    const result = await this.adminService.listEtlSyncLogs(id, {
      limit: query.limit ?? SYNC_LOG_DEFAULT_LIMIT,
      offset: query.offset ?? 0,
    });

    return {
      logs: result.logs,
      total: result.total,
    };
  }

  @Get('etl-syncs/:id/jobs/:jobRunId/errors')
  async listJobErrors(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('jobRunId', zodPipe(uuidSchema)) jobRunId: string,
    @Query(zodPipe(adminListQuerySchema)) query: AdminListQuery,
  ) {
    const result = await this.adminService.listJobErrors(id, jobRunId, {
      limit: query.limit ?? ADMIN_LIST_DEFAULT_LIMIT,
      offset: query.offset ?? 0,
    });

    return {
      errors: result.errors,
      total: result.total,
    };
  }

  @Get('etl-syncs/:id/jobs/:jobRunId/reconciliation')
  async getJobReconciliation(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('jobRunId', zodPipe(uuidSchema)) jobRunId: string,
  ) {
    return {
      reconciliation: await this.adminService.getJobReconciliation(id, jobRunId),
    };
  }

  @Get('etl-syncs/:id/jobs/:jobRunId/unmatched')
  async listJobUnmatched(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('jobRunId', zodPipe(uuidSchema)) jobRunId: string,
    @Query(zodPipe(adminListQuerySchema)) query: AdminListQuery,
  ) {
    const result = await this.adminService.listJobUnmatched(id, jobRunId, {
      limit: query.limit ?? ADMIN_LIST_DEFAULT_LIMIT,
      offset: query.offset ?? 0,
    });

    return {
      unmatched: result.unmatched,
      total: result.total,
    };
  }

  @Get('recommendation-downweights')
  async listRecommendationDownweights() {
    return { downweights: await this.recommendations.list() };
  }

  @Post('recommendation-downweights')
  async createRecommendationDownweight(
    @Body(zodPipe(createRecommendationDownweightBodySchema))
    body: CreateRecommendationDownweightBody,
  ) {
    return { downweight: await this.recommendations.create(body) };
  }

  @Delete('recommendation-downweights/:cardId')
  @HttpCode(204)
  async deleteRecommendationDownweight(@Param('cardId', zodPipe(uuidSchema)) cardId: string) {
    await this.recommendations.remove(cardId);
  }
}
