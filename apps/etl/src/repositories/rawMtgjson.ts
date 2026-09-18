import type { PoolClient } from 'pg'

export type RawMtgjsonUpsert = {
  mtgjsonUuid: string
  scryfallId: string | null
  payload: unknown
  payloadHash: string
}

export type UpsertBatchResult = {
  inserted: number
  updated: number
  unchanged: number
}

/**
 * Batch upsert into raw.mtgjson_card.
 * Rows whose payload_hash is unchanged are left alone.
 */
export async function upsertMtgjsonCards(
  client: PoolClient,
  rows: RawMtgjsonUpsert[],
): Promise<UpsertBatchResult> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, unchanged: 0 }
  }

  const values: unknown[] = []
  const placeholders: string[] = []

  rows.forEach((row, i) => {
    const o = i * 4
    placeholders.push(`($${o + 1}, $${o + 2}, $${o + 3}::jsonb, $${o + 4})`)
    values.push(
      row.mtgjsonUuid,
      row.scryfallId,
      JSON.stringify(row.payload),
      row.payloadHash,
    )
  })

  const result = await client.query<{ is_insert: boolean }>(
    `insert into raw.mtgjson_card as t
       (mtgjson_uuid, scryfall_id, payload, payload_hash)
     values ${placeholders.join(',')}
     on conflict (mtgjson_uuid) do update set
       scryfall_id = excluded.scryfall_id,
       payload = excluded.payload,
       payload_hash = excluded.payload_hash,
       ingested_at = now()
     where t.payload_hash is distinct from excluded.payload_hash
     returning (xmax::text = '0') as is_insert`,
    values,
  )

  let inserted = 0
  let updated = 0
  for (const row of result.rows) {
    if (row.is_insert) inserted += 1
    else updated += 1
  }

  return {
    inserted,
    updated,
    unchanged: rows.length - result.rows.length,
  }
}
