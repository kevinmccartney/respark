import type { PoolClient } from 'pg';

import { upsertHashGatedBatch, type UpsertBatchResult } from './rawUpsert';

export type RawScryfallUpsert = {
  scryfallId: string;
  oracleId: string | null;
  payload: unknown;
  sourceUpdatedAt: Date | null;
  payloadHash: string;
};

export type { UpsertBatchResult };

/**
 * Batch upsert into raw.scryfall_card.
 * Rows whose payload_hash is unchanged are left alone (counted as unchanged).
 */
export const upsertScryfallCards = async (
  client: PoolClient,
  rows: RawScryfallUpsert[],
): Promise<UpsertBatchResult> =>
  upsertHashGatedBatch(
    client,
    {
      table: 'raw.scryfall_card',
      conflictTarget: 'scryfall_id',
      columns: [
        { name: 'scryfall_id', cast: 'uuid' },
        { name: 'oracle_id', cast: 'uuid' },
        { name: 'payload', cast: 'jsonb' },
        { name: 'source_updated_at', cast: 'timestamptz' },
        { name: 'payload_hash' },
      ],
      updateColumns: ['oracle_id', 'payload', 'source_updated_at', 'payload_hash'],
    },
    rows.map((row) => [
      row.scryfallId,
      row.oracleId,
      JSON.stringify(row.payload),
      row.sourceUpdatedAt,
      row.payloadHash,
    ]),
  );
