import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AdminRoleGuard } from '../auth/admin-role.guard'
import { ClerkAuthGuard } from '../auth/clerk-auth.guard'
import { AdminEtlService } from './admin-etl.service'
import { AdminService } from './admin.service'

@Controller('admin')
@UseGuards(ClerkAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminEtl: AdminEtlService,
  ) {}

  @Post('etl-job')
  @HttpCode(202)
  async startEtlJob(@Body() body: { source?: unknown }) {
    const source = typeof body?.source === 'string' ? body.source.trim() : ''
    if (!source) {
      throw new BadRequestException('source is required')
    }

    return this.adminEtl.startJob(source)
  }

  @Get('ingestion-runs')
  async listIngestionRuns(
    @Query('limit') limitRaw?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
  ) {
    return {
      runs: await this.adminService.listIngestionRuns({
        limit: parseLimit(limitRaw, 50, 200),
        source: nonempty(source),
        status: nonempty(status),
      }),
    }
  }

  @Get('ingestion-runs/:id')
  async getIngestionRun(@Param('id', ParseUUIDPipe) id: string) {
    return {
      run: await this.adminService.getIngestionRun(id),
    }
  }

  @Get('ingestion-runs/:id/errors')
  async listIngestionErrors(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const result = await this.adminService.listIngestionErrors(id, {
      limit: parseLimit(limitRaw, 50, 200),
      offset: parseOffset(offsetRaw),
    })

    return {
      errors: result.errors,
      total: result.total,
    }
  }
}

function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(Math.floor(n), max)
}

function parseOffset(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

function nonempty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
