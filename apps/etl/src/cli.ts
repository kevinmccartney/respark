#!/usr/bin/env node
import { Command } from 'commander'
import { createPool, loadEnv } from './core/db.js'
import { createLogger } from './core/logger.js'
import { ETL_SOURCES, type GlobalFlags } from './core/types.js'
import { runScryfallImport } from './sources/scryfall/importer.js'

loadEnv()

const program = new Command()

program
  .name('respark-etl')
  .description('MTG data pipeline CLI (Scryfall, MTGJSON, JustTCG)')
  .option('--limit <n>', 'Cap records processed (dev)', (v) => Number.parseInt(v, 10))
  .option('--dry-run', 'Validate without writing raw/canonical data', false)
  .option('--verbose', 'Debug logging', false)
  .option('--store-raw', 'Persist raw provider payloads (default true)', undefined)
  .option('--no-store-raw', 'Skip raw payload persistence')

function flagsFrom(cmd: Command): GlobalFlags {
  const opts = cmd.optsWithGlobals() as {
    limit?: number
    dryRun?: boolean
    verbose?: boolean
    storeRaw?: boolean
  }
  return {
    limit: opts.limit,
    dryRun: Boolean(opts.dryRun),
    verbose: Boolean(opts.verbose),
    storeRaw: opts.storeRaw,
  }
}

async function withDb<T>(work: (pool: ReturnType<typeof createPool>) => Promise<T>): Promise<T> {
  const pool = createPool()
  try {
    return await work(pool)
  } finally {
    await pool.end()
  }
}

function stub(command: string, description: string) {
  program
    .command(command)
    .description(`${description} (not implemented yet)`)
    .action(async () => {
      const flags = flagsFrom(program)
      const logger = createLogger(flags.verbose)
      logger.info(
        { event: 'etl.stub', command, ...flags },
        `${command} is not implemented yet`,
      )
    })
}

program
  .command('ping')
  .description('Verify DATABASE_URL connectivity (SELECT 1)')
  .action(async () => {
    const flags = flagsFrom(program)
    const logger = createLogger(flags.verbose)
    await withDb(async (pool) => {
      const result = await pool.query<{ ok: number }>('select 1 as ok')
      logger.info({ event: 'etl.ping', ok: result.rows[0]?.ok }, 'Database reachable')
    })
  })

program
  .command('scryfall')
  .description('Ingest Scryfall bulk data into raw.scryfall_card')
  .action(async () => {
    const flags = flagsFrom(program)
    const logger = createLogger(flags.verbose)
    await withDb(async (pool) => {
      await runScryfallImport(pool, logger, flags)
    })
  })

for (const source of ETL_SOURCES) {
  if (source === 'scryfall') continue
  stub(source, `Ingest from ${source}`)
}

stub('all', 'Run every source pipeline')
stub('report', 'Emit database size / ETL metrics report')
stub('forecast', 'Emit capacity forecast from measured sizes')

await program.parseAsync(process.argv)
