#!/usr/bin/env node
import { Command } from 'commander'
import { createPool, loadEnv } from './core/db.js'
import { createLogger } from './core/logger.js'
import { ETL_SOURCES, type GlobalFlags } from './core/types.js'

loadEnv()

const program = new Command()

program
  .name('respark-etl')
  .description('MTG data pipeline CLI (Scryfall, MTGJSON, JustTCG)')
  .option('--limit <n>', 'Cap records processed (dev)', (v) => Number.parseInt(v, 10))
  .option('--dry-run', 'Validate without writing canonical data', false)
  .option('--verbose', 'Debug logging', false)
  .option('--store-raw', 'Persist raw provider payloads', false)
  .option('--no-store-raw', 'Skip raw payload persistence')

function flagsFrom(cmd: Command): GlobalFlags {
  const opts = cmd.optsWithGlobals()
  return {
    limit: opts.limit,
    dryRun: Boolean(opts.dryRun),
    verbose: Boolean(opts.verbose),
    storeRaw: opts.storeRaw === undefined ? undefined : Boolean(opts.storeRaw),
  }
}

async function withDb(verbose: boolean, work: (pool: ReturnType<typeof createPool>) => Promise<void>) {
  const pool = createPool()
  try {
    await work(pool)
  } finally {
    await pool.end()
  }
}

function stub(command: string, description: string) {
  program
    .command(command)
    .description(`${description} (Phase 1 stub — not implemented yet)`)
    .action(async () => {
      const flags = flagsFrom(program)
      const logger = createLogger(flags.verbose)
      logger.info(
        { event: 'etl.stub', command, ...flags },
        `${command} is not implemented yet (Phase 1 skeleton)`,
      )
    })
}

program
  .command('ping')
  .description('Verify DATABASE_URL connectivity (SELECT 1)')
  .action(async () => {
    const flags = flagsFrom(program)
    const logger = createLogger(flags.verbose)
    await withDb(flags.verbose, async (pool) => {
      const result = await pool.query<{ ok: number }>('select 1 as ok')
      logger.info({ event: 'etl.ping', ok: result.rows[0]?.ok }, 'Database reachable')
    })
  })

for (const source of ETL_SOURCES) {
  stub(source, `Ingest from ${source}`)
}

stub('all', 'Run every source pipeline')
stub('report', 'Emit database size / ETL metrics report')
stub('forecast', 'Emit capacity forecast from measured sizes')

await program.parseAsync(process.argv)
