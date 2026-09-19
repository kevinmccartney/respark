import type { PoolClient } from 'pg';

export type RawScryfallUpsert = {
  scryfallId: string;
  oracleId: string | null;
  payload: unknown;
  sourceUpdatedAt: Date | null;
  payloadHash: string;
};

export type UpsertBatchResult = {
  inserted: number;
  updated: number;
  unchanged: number;
};

/**
 * Batch upsert into raw.scryfall_card.
 * Rows whose payload_hash is unchanged are left alone (counted as unchanged).
 */
export async function upsertScryfallCards(
  client: PoolClient,
  rows: RawScryfallUpsert[],
): Promise<UpsertBatchResult> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, unchanged: 0 };
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  rows.forEach((row, i) => {
    const o = i * 5;
    placeholders.push(
      `($${o + 1}::uuid, $${o + 2}::uuid, $${o + 3}::jsonb, $${o + 4}::timestamptz, $${o + 5})`,
    );
    values.push(
      row.scryfallId,
      row.oracleId,
      JSON.stringify(row.payload),
      row.sourceUpdatedAt,
      row.payloadHash,
    );
  });

  // xmax = 0 → insert; otherwise an update that passed the WHERE clause.
  // Conflicts skipped by WHERE do not appear in RETURNING → unchanged.
  const result = await client.query<{ is_insert: boolean }>(
    `insert into raw.scryfall_card as t
       (scryfall_id, oracle_id, payload, source_updated_at, payload_hash)
     values ${placeholders.join(',')}
     on conflict (scryfall_id) do update set
       oracle_id = excluded.oracle_id,
       payload = excluded.payload,
       source_updated_at = excluded.source_updated_at,
       payload_hash = excluded.payload_hash,
       ingested_at = now()
     where t.payload_hash is distinct from excluded.payload_hash
     returning (xmax::text = '0') as is_insert`,
    values,
  );

  let inserted = 0;
  let updated = 0;
  for (const row of result.rows) {
    if (row.is_insert) inserted += 1;
    else updated += 1;
  }

  return {
    inserted,
    updated,
    unchanged: rows.length - result.rows.length,
  };
}
