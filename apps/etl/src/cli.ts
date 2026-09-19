#!/usr/bin/env node
import { Command } from 'commander';
import { createPool, loadEnv } from './core/db';
import { createLogger } from './core/logger';
import type { GlobalFlags } from './core/types';
import { writeSizeReport } from './commands/report';
import { parseEnrichmentJobs, runEtlSync, type EnrichmentJobId } from './lib/run-sync';

loadEnv();

const program = new Command();

program
  .name('respark-etl')
  .description('MTG data pipeline CLI — sync (catalog + enrichment stages/jobs)')
  .option('--limit <n>', 'Cap records processed (dev)', (v) => Number.parseInt(v, 10))
  .option('--dry-run', 'Validate without writing raw/canonical data', false)
  .option('--verbose', 'Debug logging', false)
  .option('--store-raw', 'Persist raw provider payloads (default true)', undefined)
  .option('--no-store-raw', 'Skip raw payload persistence');

function flagsFrom(cmd: Command): GlobalFlags {
  const opts = cmd.optsWithGlobals() as {
    limit?: number;
    dryRun?: boolean;
    verbose?: boolean;
    storeRaw?: boolean;
  };
  return {
    limit: opts.limit,
    dryRun: Boolean(opts.dryRun),
    verbose: Boolean(opts.verbose),
    storeRaw: opts.storeRaw,
  };
}

async function withDb<T>(work: (pool: ReturnType<typeof createPool>) => Promise<T>): Promise<T> {
  const pool = createPool();
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

function stub(command: string, description: string) {
  program
    .command(command)
    .description(`${description} (not implemented yet)`)
    .action(async () => {
      const flags = flagsFrom(program);
      const logger = createLogger(flags.verbose);
      logger.info({ event: 'etl.stub', command, ...flags }, `${command} is not implemented yet`);
    });
}

async function runSyncCommand(opts: {
  catalog?: boolean;
  enrichment?: string | string[];
  demoMismatches?: boolean;
}): Promise<void> {
  const flags = flagsFrom(program);
  flags.demoMismatches = Boolean(opts.demoMismatches);
  const logger = createLogger(flags.verbose);
  const catalog = Boolean(opts.catalog);
  let enrichmentJobs: EnrichmentJobId[];
  try {
    enrichmentJobs = parseEnrichmentJobs(opts.enrichment);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  await withDb(async (pool) => {
    const status = await runEtlSync(pool, logger, {
      ...flags,
      catalog,
      enrichmentJobs,
    });
    if (status === 'failed' || status === 'partial_success') {
      process.exitCode = 1;
    }
  });
}

program
  .command('ping')
  .description('Verify DATABASE_URL connectivity (SELECT 1)')
  .action(async () => {
    const flags = flagsFrom(program);
    const logger = createLogger(flags.verbose);
    await withDb(async (pool) => {
      const result = await pool.query<{ ok: number }>('select 1 as ok');
      logger.info({ event: 'etl.ping', ok: result.rows[0]?.ok }, 'Database reachable');
    });
  });

program
  .command('sync')
  .description(
    'Run an ETL sync (catalog and/or enrichment jobs). Example: sync --catalog --enrichment identifiers',
  )
  .option('--catalog', 'Include catalog stage (Scryfall)', false)
  .option('--enrichment <jobs>', 'Comma-separated enrichment jobs (currently: identifiers)')
  .option(
    '--demo-mismatches',
    'Identifiers job: skip download; inject synthetic unmatched + ambiguous cases',
    false,
  )
  .action(async (opts: { catalog?: boolean; enrichment?: string; demoMismatches?: boolean }) => {
    await runSyncCommand(opts);
  });

program
  .command('report')
  .description('Emit database size / ETL metrics report to reports/etl-size-report.json')
  .action(async () => {
    const flags = flagsFrom(program);
    const logger = createLogger(flags.verbose);
    await withDb(async (pool) => {
      const report = await writeSizeReport(pool, logger);
      logger.info(
        {
          event: 'etl.report.summary',
          database: report.database.pretty,
          schemas: Object.fromEntries(
            Object.entries(report.schemas).map(([k, v]) => [k, v.pretty]),
          ),
          largest: report.largestTables.slice(0, 5).map((t) => ({
            name: `${t.schema}.${t.table}`,
            rows: t.rows,
            size: t.pretty,
          })),
        },
        'Size report summary',
      );
    });
  });

stub('forecast', 'Emit capacity forecast from measured sizes');

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
