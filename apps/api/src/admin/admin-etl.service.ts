import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { DATABASE, type Database } from '../db/database.module'
import { etlSyncs } from '../db/schema'

export const ENRICHMENT_JOB_IDS = ['identifiers'] as const
export type EnrichmentJobId = (typeof ENRICHMENT_JOB_IDS)[number]

export type StartSyncInput = {
  catalog: boolean
  enrichmentJobs: EnrichmentJobId[]
}

@Injectable()
export class AdminEtlService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(AdminEtlService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Start an ETL sync via the CLI (`sync --catalog --enrichment …`).
   * Spawns in the background so the HTTP request returns immediately.
   */
  async startSync(
    input: StartSyncInput,
  ): Promise<{ accepted: true; catalog: boolean; enrichmentJobs: string[] }> {
    if (!input.catalog && input.enrichmentJobs.length === 0) {
      throw new BadRequestException(
        'At least one of catalog or enrichmentJobs is required',
      )
    }

    for (const job of input.enrichmentJobs) {
      if (!ENRICHMENT_JOB_IDS.includes(job)) {
        throw new BadRequestException(
          `Unknown enrichment job "${job}". Expected: ${ENRICHMENT_JOB_IDS.join(', ')}`,
        )
      }
    }

    const [running] = await this.db
      .select({ id: etlSyncs.id })
      .from(etlSyncs)
      .where(eq(etlSyncs.status, 'running'))
      .limit(1)

    if (running) {
      throw new ConflictException(
        `An ETL sync is already in progress (${running.id}). Wait for it to finish.`,
      )
    }

    const { command, args, cwd } = resolveEtlLaunch(input)

    this.logger.info(
      {
        event: 'admin.etl_sync.start',
        catalog: input.catalog,
        enrichmentJobs: input.enrichmentJobs,
        command,
        args,
        cwd,
      },
      'Starting ETL sync',
    )

    try {
      const child = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
        },
      })

      const pid = child.pid
      this.logger.info(
        { event: 'admin.etl_sync.spawned', pid },
        'ETL process spawned',
      )

      const stderrTail: string[] = []
      child.stdout?.on('data', (buf: Buffer) => {
        const line = buf.toString('utf8').trimEnd()
        if (line) {
          this.logger.info(
            { event: 'admin.etl_sync.stdout', pid, line },
            line,
          )
        }
      })
      child.stderr?.on('data', (buf: Buffer) => {
        const line = buf.toString('utf8').trimEnd()
        if (line) {
          stderrTail.push(line)
          if (stderrTail.length > 20) stderrTail.shift()
          this.logger.warn(
            { event: 'admin.etl_sync.stderr', pid, line },
            line,
          )
        }
      })
      child.on('error', (err) => {
        this.logger.error(
          { event: 'admin.etl_sync.spawn_error', pid, err },
          'Failed to spawn ETL process',
        )
      })
      child.on('exit', (code, signal) => {
        const level = code === 0 ? 'info' : 'error'
        this.logger[level](
          {
            event: 'admin.etl_sync.exit',
            pid,
            code,
            signal,
            stderr: code === 0 ? undefined : stderrTail.join('\n') || undefined,
          },
          code === 0
            ? 'ETL process exited successfully'
            : 'ETL process exited with error',
        )
      })
    } catch (err) {
      this.logger.error(
        { event: 'admin.etl_sync.spawn_failed', err },
        'Could not start ETL process',
      )
      throw new ServiceUnavailableException(
        'Could not start the ETL CLI. Is apps/etl available on this host?',
      )
    }

    return {
      accepted: true,
      catalog: input.catalog,
      enrichmentJobs: input.enrichmentJobs,
    }
  }
}

function resolveEtlLaunch(input: StartSyncInput): {
  command: string
  args: string[]
  cwd: string
} {
  const syncArgs = ['sync']
  if (input.catalog) syncArgs.push('--catalog')
  if (input.enrichmentJobs.length > 0) {
    syncArgs.push('--enrichment', input.enrichmentJobs.join(','))
  }

  if (process.env.ETL_COMMAND?.trim()) {
    const parts = process.env.ETL_COMMAND.trim().split(/\s+/)
    return {
      command: parts[0],
      args: [...parts.slice(1), ...syncArgs],
      cwd: process.env.ETL_REPO_ROOT?.trim() || process.cwd(),
    }
  }

  const repoRoot = findRepoRoot()
  const distCli = resolve(repoRoot, 'apps/etl/dist/cli.js')
  const srcCli = resolve(repoRoot, 'apps/etl/src/cli.ts')
  const preferSource =
    process.env.ETL_PREFER_SOURCE === 'true' ||
    process.env.NODE_ENV !== 'production'

  if (preferSource && existsSync(srcCli)) {
    return {
      command: 'npx',
      args: ['tsx', 'apps/etl/src/cli.ts', ...syncArgs],
      cwd: repoRoot,
    }
  }

  if (existsSync(distCli)) {
    return {
      command: process.execPath,
      args: [distCli, ...syncArgs],
      cwd: repoRoot,
    }
  }

  if (existsSync(srcCli)) {
    return {
      command: 'npx',
      args: ['tsx', 'apps/etl/src/cli.ts', ...syncArgs],
      cwd: repoRoot,
    }
  }

  throw new ServiceUnavailableException(
    'ETL CLI not found. Build apps/etl or set ETL_COMMAND / ETL_REPO_ROOT.',
  )
}

function findRepoRoot(): string {
  if (process.env.ETL_REPO_ROOT?.trim()) {
    return process.env.ETL_REPO_ROOT.trim()
  }

  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'apps/etl/package.json'))) {
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }

  throw new ServiceUnavailableException(
    'Could not locate apps/etl. Set ETL_REPO_ROOT to the monorepo root.',
  )
}
