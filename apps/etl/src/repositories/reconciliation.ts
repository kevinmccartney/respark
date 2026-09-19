import type { Pool, PoolClient } from 'pg';
import type { UnmatchedRecord } from './mtgjsonReconcile';

export type ReconciliationSummaryInput = {
  runId: string;
  matched: number;
  unmatched: number;
  ambiguous: number;
  identifiersAdded: number;
  rawInserted: number | null;
  rawUpdated: number | null;
  rawUnchanged: number | null;
  storeRaw: boolean | null;
  demoMismatches: boolean;
  dryRun: boolean;
  limitN: number | null;
};

export const upsertIngestionReconciliation = async (
  client: Pool | PoolClient,
  input: ReconciliationSummaryInput,
): Promise<void> => {
  await client.query(
    `insert into ops.ingestion_reconciliation as t
       (run_id, matched, unmatched, ambiguous, identifiers_added,
        raw_inserted, raw_updated, raw_unchanged, store_raw,
        demo_mismatches, dry_run, limit_n)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (run_id) do update set
       matched = excluded.matched,
       unmatched = excluded.unmatched,
       ambiguous = excluded.ambiguous,
       identifiers_added = excluded.identifiers_added,
       raw_inserted = excluded.raw_inserted,
       raw_updated = excluded.raw_updated,
       raw_unchanged = excluded.raw_unchanged,
       store_raw = excluded.store_raw,
       demo_mismatches = excluded.demo_mismatches,
       dry_run = excluded.dry_run,
       limit_n = excluded.limit_n`,
    [
      input.runId,
      input.matched,
      input.unmatched,
      input.ambiguous,
      input.identifiersAdded,
      input.rawInserted,
      input.rawUpdated,
      input.rawUnchanged,
      input.storeRaw,
      input.demoMismatches,
      input.dryRun,
      input.limitN,
    ],
  );
};

/**
 * Replace unmatched samples for a run (idempotent re-finish).
 */
export const replaceUnmatchedRecords = async (
  client: Pool | PoolClient,
  runId: string,
  rows: UnmatchedRecord[],
): Promise<void> => {
  await client.query(`delete from ops.ingestion_unmatched where run_id = $1`, [runId]);
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  rows.forEach((row, i) => {
    const o = i * 8;
    placeholders.push(
      `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8})`,
    );
    values.push(
      runId,
      row.mtgjsonUuid,
      row.name,
      row.setCode,
      row.collectorNumber,
      row.language,
      row.scryfallId,
      row.reason,
    );
  });

  await client.query(
    `insert into ops.ingestion_unmatched
       (run_id, external_id, name, set_code, collector_number, language, scryfall_id, reason)
     values ${placeholders.join(',')}`,
    values,
  );
};
