import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Pool } from 'pg';
import type { Logger } from '../core/logger';

const PIPELINE_SCHEMAS = ['raw', 'catalog', 'market', 'ops', 'app'] as const;

const repoRoot = resolve(__dirname, '../../../..');
export const DEFAULT_REPORT_PATH = resolve(repoRoot, 'reports/etl-size-report.json');

export type SizeReport = {
  generatedAt: string;
  database: { name: string; bytes: number; pretty: string };
  schemas: Record<string, { bytes: number; pretty: string }>;
  tables: Array<{
    schema: string;
    table: string;
    rows: number;
    dataBytes: number;
    indexBytes: number;
    totalBytes: number;
    pretty: string;
  }>;
  largestTables: SizeReport['tables'];
  latestRuns: Array<{
    id: string;
    source: string;
    status: string;
    recordsSeen: number | null;
    recordsInserted: number | null;
    recordsUpdated: number | null;
    recordsUnchanged: number | null;
    recordsFailed: number | null;
    downloadBytes: number | null;
    durationMs: number | null;
    rowsPerSecond: number | null;
    completedAt: string | null;
  }>;
};

const prettyBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 || unit === 0 ? 1 : 2)} ${units[unit]}`;
};

export const collectSizeReport = async (pool: Pool): Promise<SizeReport> => {
  const db = await pool.query<{ name: string; bytes: string }>(
    `select current_database() as name, pg_database_size(current_database())::text as bytes`,
  );
  const dbBytes = Number(db.rows[0].bytes);

  const schemaRows = await pool.query<{ schema: string; bytes: string }>(
    `select n.nspname as schema,
            coalesce(sum(pg_total_relation_size(c.oid)), 0)::text as bytes
     from pg_namespace n
     left join pg_class c
       on c.relnamespace = n.oid and c.relkind in ('r', 'p', 'm', 'i', 't')
     where n.nspname = any($1::text[])
     group by n.nspname
     order by n.nspname`,
    [PIPELINE_SCHEMAS],
  );

  const schemas: SizeReport['schemas'] = {};
  for (const name of PIPELINE_SCHEMAS) {
    const row = schemaRows.rows.find((r) => r.schema === name);
    const bytes = row ? Number(row.bytes) : 0;
    schemas[name] = { bytes, pretty: prettyBytes(bytes) };
  }

  const tableRows = await pool.query<{
    schema: string;
    table: string;
    rows: string;
    data_bytes: string;
    index_bytes: string;
    total_bytes: string;
  }>(
    `select n.nspname as schema,
            c.relname as table,
            coalesce(c.reltuples, 0)::bigint::text as rows,
            pg_relation_size(c.oid)::text as data_bytes,
            pg_indexes_size(c.oid)::text as index_bytes,
            pg_total_relation_size(c.oid)::text as total_bytes
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = any($1::text[])
       and c.relkind = 'r'
     order by pg_total_relation_size(c.oid) desc, n.nspname, c.relname`,
    [PIPELINE_SCHEMAS],
  );

  // Prefer exact counts for pipeline tables (reltuples is an estimate).
  const exactCounts = await pool.query<{
    schema: string;
    table: string;
    rows: string;
  }>(
    `select table_schema as schema, table_name as table,
            (xpath('/row/c/text()',
               query_to_xml(format('select count(*) as c from %I.%I',
                 table_schema, table_name), false, true, ''))
            )[1]::text as rows
     from information_schema.tables
     where table_schema = any($1::text[])
       and table_type = 'BASE TABLE'`,
    [PIPELINE_SCHEMAS],
  );
  const countByKey = new Map(
    exactCounts.rows.map((r) => [`${r.schema}.${r.table}`, Number(r.rows)]),
  );

  const tables: SizeReport['tables'] = tableRows.rows.map((r) => {
    const dataBytes = Number(r.data_bytes);
    const indexBytes = Number(r.index_bytes);
    const totalBytes = Number(r.total_bytes);
    const key = `${r.schema}.${r.table}`;
    return {
      schema: r.schema,
      table: r.table,
      rows: countByKey.get(key) ?? Math.max(0, Math.round(Number(r.rows))),
      dataBytes,
      indexBytes,
      totalBytes,
      pretty: prettyBytes(totalBytes),
    };
  });

  const runs = await pool.query<{
    id: string;
    source: string;
    status: string;
    records_seen: number | null;
    records_inserted: number | null;
    records_updated: number | null;
    records_unchanged: number | null;
    records_failed: number | null;
    download_bytes: number | null;
    duration_ms: number | null;
    completed_at: Date | null;
  }>(
    `select id, stage || '/' || job as source, status,
            records_seen, records_inserted, records_updated,
            records_unchanged, records_failed,
            download_bytes, duration_ms, completed_at
     from ops.etl_job_run
     order by started_at desc
     limit 10`,
  );

  const latestRuns = runs.rows.map((r) => {
    const seen = r.records_seen;
    const durationMs = r.duration_ms;
    const rowsPerSecond =
      seen != null && durationMs != null && durationMs > 0
        ? Number(((seen * 1000) / durationMs).toFixed(2))
        : null;
    return {
      id: r.id,
      source: r.source,
      status: r.status,
      recordsSeen: r.records_seen,
      recordsInserted: r.records_inserted,
      recordsUpdated: r.records_updated,
      recordsUnchanged: r.records_unchanged,
      recordsFailed: r.records_failed,
      downloadBytes: r.download_bytes,
      durationMs: r.duration_ms,
      rowsPerSecond,
      completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    database: {
      name: db.rows[0].name,
      bytes: dbBytes,
      pretty: prettyBytes(dbBytes),
    },
    schemas,
    tables,
    largestTables: tables.slice(0, 20),
    latestRuns,
  };
};

export const writeSizeReport = async (
  pool: Pool,
  logger: Logger,
  outPath = DEFAULT_REPORT_PATH,
): Promise<SizeReport> => {
  const report = await collectSizeReport(pool);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  logger.info(
    {
      event: 'etl.report',
      path: outPath,
      databaseBytes: report.database.bytes,
      databasePretty: report.database.pretty,
      tableCount: report.tables.length,
    },
    `Wrote size report (${report.database.pretty})`,
  );

  return report;
};
