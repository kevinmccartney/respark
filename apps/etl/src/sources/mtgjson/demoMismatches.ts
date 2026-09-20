import type { PoolClient } from 'pg';
import { payloadHash } from '../../core/hashing';
import type { MtgjsonEnrichment } from './transformer';

export type DemoBatchItem = {
  raw: {
    mtgjsonUuid: string;
    scryfallId: string | null;
    payload: unknown;
    payloadHash: string;
  };
  enrichment: MtgjsonEnrichment;
};

const DEMO_UNMATCHED_SCRYFALL_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_AMBIGUOUS_SCRYFALL_ID = '00000000-0000-4000-8000-0000000000aa';

const demoItem = (enrichment: MtgjsonEnrichment, note: string): DemoBatchItem => {
  const payload = {
    demo: true,
    note,
    uuid: enrichment.mtgjsonUuid,
    name: enrichment.name,
    setCode: enrichment.setCode,
    number: enrichment.collectorNumber,
    language: enrichment.language,
    identifiers: { scryfallId: enrichment.scryfallId ?? undefined },
  };
  return {
    raw: {
      mtgjsonUuid: enrichment.mtgjsonUuid,
      scryfallId: enrichment.scryfallId,
      payload,
      payloadHash: payloadHash(payload),
    },
    enrichment,
  };
};

/**
 * Synthetic cards that miss catalog.printing (real resolvePrinting → unmatched).
 */
export const buildDemoUnmatchedItems = (): DemoBatchItem[] => [
  demoItem(
    {
      mtgjsonUuid: 'demo-unmatched-no-scryfall',
      name: 'Demo Card (no Scryfall id)',
      setCode: 'ZZZ',
      collectorNumber: '99999',
      language: null,
      scryfallId: null,
      leadershipSkills: null,
      edhrecSaltiness: null,
      isGameChanger: null,
      identifiers: [{ provider: 'mtgjson', externalId: 'demo-unmatched-no-scryfall' }],
    },
    'Synthetic unmatched: fake set/number, no scryfallId',
  ),
  demoItem(
    {
      mtgjsonUuid: 'demo-unmatched-bad-scryfall',
      name: 'Demo Card (unknown Scryfall id)',
      setCode: 'ZZZ',
      collectorNumber: '99998',
      language: 'English',
      scryfallId: DEMO_UNMATCHED_SCRYFALL_ID,
      leadershipSkills: null,
      edhrecSaltiness: null,
      isGameChanger: null,
      identifiers: [
        { provider: 'mtgjson', externalId: 'demo-unmatched-bad-scryfall' },
        { provider: 'tcgplayer', externalId: 'demo-tcg-999' },
      ],
    },
    'Synthetic unmatched: valid-looking scryfallId absent from catalog',
  ),
];

/**
 * Clone an existing printing (same set + collector_number, new scryfall_id)
 * so set/number reconciliation returns ambiguous. Caller must cleanup().
 */
export const installDemoAmbiguousClone = async (
  client: PoolClient,
): Promise<{ item: DemoBatchItem; cleanup: () => Promise<void> } | null> => {
  const seed = await client.query<{
    id: string;
    card_id: string;
    set_id: string;
    collector_number: string;
    set_code: string;
    name: string;
  }>(
    `select p.id, p.card_id, p.set_id, p.collector_number, s.code as set_code, c.name
     from catalog.printing p
     join catalog.set s on s.id = p.set_id
     join catalog.card c on c.id = p.card_id
     limit 1`,
  );
  if (!seed.rows[0]) return null;

  const row = seed.rows[0];
  const inserted = await client.query<{ id: string }>(
    `insert into catalog.printing
       (scryfall_id, card_id, set_id, collector_number, language, rarity, updated_at)
     values ($1::uuid, $2, $3, $4, 'en', 'demo', now())
     returning id`,
    [DEMO_AMBIGUOUS_SCRYFALL_ID, row.card_id, row.set_id, row.collector_number],
  );
  const cloneId = inserted.rows[0].id;

  const item = demoItem(
    {
      mtgjsonUuid: 'demo-ambiguous-set-number',
      name: `${row.name} (demo ambiguous)`,
      setCode: row.set_code,
      collectorNumber: row.collector_number,
      language: null, // omit language so both en rows collide
      scryfallId: null,
      leadershipSkills: null,
      edhrecSaltiness: null,
      isGameChanger: null,
      identifiers: [{ provider: 'mtgjson', externalId: 'demo-ambiguous-set-number' }],
    },
    `Synthetic ambiguous: cloned printing ${cloneId} beside ${row.id} for ${row.set_code}#${row.collector_number}`,
  );

  return {
    item,
    cleanup: async () => {
      await client.query(`delete from catalog.printing where id = $1`, [cloneId]);
    },
  };
};
