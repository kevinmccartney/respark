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
import {
  AdminEtlService,
} from './admin-etl.service'
import { AdminService } from './admin.service'
import { ENRICHMENT_JOB_IDS, type EnrichmentJobId } from 'etl'

@Controller('admin')
@UseGuards(ClerkAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminEtl: AdminEtlService,
  ) {}

  @Post('etl-syncs')
  @HttpCode(202)
  async startEtlSync(
    @Body() body: { catalog?: unknown; enrichmentJobs?: unknown },
  ) {
    const catalog = Boolean(body?.catalog)
    const enrichmentJobs = parseEnrichmentJobs(body?.enrichmentJobs)
    return this.adminEtl.startSync({ catalog, enrichmentJobs })
  }

  @Get('etl-syncs')
  async listEtlSyncs(
    @Query('limit') limitRaw?: string,
    @Query('status') status?: string,
  ) {
    return {
      syncs: await this.adminService.listEtlSyncs({
        limit: parseLimit(limitRaw, 50, 200),
        status: nonempty(status),
      }),
    }
  }

  @Get('etl-syncs/:id')
  async getEtlSync(@Param('id', ParseUUIDPipe) id: string) {
    return {
      sync: await this.adminService.getEtlSync(id),
    }
  }

  @Get('etl-syncs/:id/jobs/:jobRunId/errors')
  async listJobErrors(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobRunId', ParseUUIDPipe) jobRunId: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const result = await this.adminService.listJobErrors(id, jobRunId, {
      limit: parseLimit(limitRaw, 50, 200),
      offset: parseOffset(offsetRaw),
    })

    return {
      errors: result.errors,
      total: result.total,
    }
  }

  @Get('etl-syncs/:id/jobs/:jobRunId/reconciliation')
  async getJobReconciliation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobRunId', ParseUUIDPipe) jobRunId: string,
  ) {
    return {
      reconciliation: await this.adminService.getJobReconciliation(id, jobRunId),
    }
  }

  @Get('etl-syncs/:id/jobs/:jobRunId/unmatched')
  async listJobUnmatched(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('jobRunId', ParseUUIDPipe) jobRunId: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const result = await this.adminService.listJobUnmatched(id, jobRunId, {
      limit: parseLimit(limitRaw, 50, 200),
      offset: parseOffset(offsetRaw),
    })

    return {
      unmatched: result.unmatched,
      total: result.total,
    }
  }
}

function parseEnrichmentJobs(raw: unknown): EnrichmentJobId[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    throw new BadRequestException('enrichmentJobs must be an array of strings')
  }
  const jobs: EnrichmentJobId[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new BadRequestException('enrichmentJobs must be an array of strings')
    }
    const job = item.trim() as EnrichmentJobId
    if (!(ENRICHMENT_JOB_IDS as readonly string[]).includes(job)) {
      throw new BadRequestException(
        `Unknown enrichment job "${item}". Expected: ${ENRICHMENT_JOB_IDS.join(', ')}`,
      )
    }
    if (!jobs.includes(job)) jobs.push(job)
  }
  return jobs
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
