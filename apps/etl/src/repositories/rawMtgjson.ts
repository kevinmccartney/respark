import type { PoolClient } from 'pg';
import { upsertHashGatedBatch, type UpsertBatchResult } from './rawUpsert';

export type RawMtgjsonUpsert = {
  mtgjsonUuid: string;
  scryfallId: string | null;
  payload: unknown;
  payloadHash: string;
};

export type { UpsertBatchResult };

/**
 * Batch upsert into raw.mtgjson_card.
 * Rows whose payload_hash is unchanged are left alone.
 */
export const upsertMtgjsonCards = async (
  client: PoolClient,
  rows: RawMtgjsonUpsert[],
): Promise<UpsertBatchResult> =>
  upsertHashGatedBatch(
    client,
    {
      table: 'raw.mtgjson_card',
      conflictTarget: 'mtgjson_uuid',
      columns: [
        { name: 'mtgjson_uuid' },
        { name: 'scryfall_id' },
        { name: 'payload', cast: 'jsonb' },
        { name: 'payload_hash' },
      ],
      updateColumns: ['scryfall_id', 'payload', 'payload_hash'],
    },
    rows.map((row) => [
      row.mtgjsonUuid,
      row.scryfallId,
      JSON.stringify(row.payload),
      row.payloadHash,
    ]),
  );
