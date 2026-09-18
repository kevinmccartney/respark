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
import { ingestionRuns } from '../db/schema'

/** Canonical pipeline ids (DB / CLI). */
export const ETL_SOURCES = ['scryfall', 'mtgjson', 'justtcg'] as const
export type EtlSourceId = (typeof ETL_SOURCES)[number]

const IMPLEMENTED_SOURCES = new Set<EtlSourceId>(['scryfall'])

@Injectable()
export class AdminEtlService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(AdminEtlService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Accepts display names like "Scryfall" or canonical "scryfall".
   * Spawns the ETL CLI in the background so the HTTP request returns immediately.
   */
  async startJob(sourceRaw: string): Promise<{ accepted: true; source: EtlSourceId }> {
    const source = normalizeSource(sourceRaw)
    if (!source) {
      throw new BadRequestException(
        `Unknown source "${sourceRaw}". Expected one of: Scryfall, MTGJSON, JustTCG`,
      )
    }

    if (!IMPLEMENTED_SOURCES.has(source)) {
      throw new BadRequestException(`ETL source "${source}" is not implemented yet`)
    }

    const [running] = await this.db
      .select({ id: ingestionRuns.id })
      .from(ingestionRuns)
      .where(eq(ingestionRuns.status, 'running'))
      .limit(1)

    if (running) {
      throw new ConflictException(
        `An ETL run is already in progress (${running.id}). Wait for it to finish.`,
      )
    }

    const { command, args, cwd } = resolveEtlLaunch(source)

    this.logger.info(
      { event: 'admin.etl_job.start', source, command, args, cwd },
      'Starting ETL job',
    )

    try {
      const child = spawn(command, args, {
        cwd,
        // Keep the child in the same process group so Docker/dev logs can attach;
        // do not detach — detached + stdio ignore hid ECONNREFUSED failures.
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
        },
      })

      const pid = child.pid
      this.logger.info({ event: 'admin.etl_job.spawned', source, pid }, 'ETL process spawned')

      const stderrTail: string[] = []
      child.stdout?.on('data', (buf: Buffer) => {
        const line = buf.toString('utf8').trimEnd()
        if (line) {
          this.logger.info({ event: 'admin.etl_job.stdout', source, pid, line }, line)
        }
      })
      child.stderr?.on('data', (buf: Buffer) => {
        const line = buf.toString('utf8').trimEnd()
        if (line) {
          stderrTail.push(line)
          if (stderrTail.length > 20) stderrTail.shift()
          this.logger.warn({ event: 'admin.etl_job.stderr', source, pid, line }, line)
        }
      })
      child.on('error', (err) => {
        this.logger.error(
          { event: 'admin.etl_job.spawn_error', source, pid, err },
          'Failed to spawn ETL process',
        )
      })
      child.on('exit', (code, signal) => {
        const level = code === 0 ? 'info' : 'error'
        this.logger[level](
          {
            event: 'admin.etl_job.exit',
            source,
            pid,
            code,
            signal,
            stderr: code === 0 ? undefined : stderrTail.join('\n') || undefined,
          },
          code === 0 ? 'ETL process exited successfully' : 'ETL process exited with error',
        )
      })
    } catch (err) {
      this.logger.error(
        { event: 'admin.etl_job.spawn_failed', source, err },
        'Could not start ETL process',
      )
      throw new ServiceUnavailableException(
        'Could not start the ETL CLI. Is apps/etl available on this host?',
      )
    }

    return { accepted: true, source }
  }
}

function normalizeSource(raw: string): EtlSourceId | null {
  const key = raw.trim().toLowerCase()
  if ((ETL_SOURCES as readonly string[]).includes(key)) {
    return key as EtlSourceId
  }
  return null
}

function resolveEtlLaunch(source: EtlSourceId): {
  command: string
  args: string[]
  cwd: string
} {
  if (process.env.ETL_COMMAND?.trim()) {
    const parts = process.env.ETL_COMMAND.trim().split(/\s+/)
    return {
      command: parts[0],
      args: [...parts.slice(1), source],
      cwd: process.env.ETL_REPO_ROOT?.trim() || process.cwd(),
    }
  }

  const repoRoot = findRepoRoot()
  const distCli = resolve(repoRoot, 'apps/etl/dist/cli.js')
  const srcCli = resolve(repoRoot, 'apps/etl/src/cli.ts')

  // Prefer compiled CLI when present; fall back to tsx for source-only checkouts.
  if (existsSync(distCli)) {
    return { command: process.execPath, args: [distCli, source], cwd: repoRoot }
  }

  if (existsSync(srcCli)) {
    return {
      command: 'npx',
      args: ['tsx', 'apps/etl/src/cli.ts', source],
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
