import type { PoolClient } from 'pg';

export type UpsertBatchResult = {
  inserted: number;
  updated: number;
  unchanged: number;
};

export type HashGatedColumn = {
  name: string;
  cast?: string;
};

/**
 * INSERT … ON CONFLICT … WHERE payload_hash IS DISTINCT FROM excluded.payload_hash.
 * xmax = 0 → insert; RETURNING rows are inserts/updates; missing rows are unchanged.
 */
export const upsertHashGatedBatch = async (
  client: PoolClient,
  spec: {
    table: string;
    conflictTarget: string;
    columns: HashGatedColumn[];
    updateColumns: string[];
  },
  rows: unknown[][],
): Promise<UpsertBatchResult> => {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, unchanged: 0 };
  }

  const arity = spec.columns.length;
  const values = rows.flat();
  const placeholders = rows.map((_, i) => {
    const parts = spec.columns.map((col, j) => {
      const n = i * arity + j + 1;
      return col.cast ? `$${n}::${col.cast}` : `$${n}`;
    });
    return `(${parts.join(', ')})`;
  });

  const assignments = [
    ...spec.updateColumns.map((column) => `${column} = excluded.${column}`),
    'ingested_at = now()',
  ].join(',\n       ');

  const result = await client.query<{ is_insert: boolean }>(
    `insert into ${spec.table} as t
       (${spec.columns.map((col) => col.name).join(', ')})
     values ${placeholders.join(',')}
     on conflict (${spec.conflictTarget}) do update set
       ${assignments}
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
};
