import type { PoolClient } from 'pg';
import type { CanonicalRecord } from '../sources/scryfall/transformer';

export type CatalogUpsertResult = {
  inserted: number;
  updated: number;
  unchanged: number;
};

const upsertSet = async (client: PoolClient, record: CanonicalRecord): Promise<string> => {
  const s = record.set;
  const result = await client.query<{ id: string }>(
    `insert into catalog.set as t
       (scryfall_id, code, name, set_type, released_at, digital, updated_at)
     values ($1, $2, $3, $4, $5::date, $6, now())
     on conflict (code) do update set
       scryfall_id = coalesce(excluded.scryfall_id, t.scryfall_id),
       name = excluded.name,
       set_type = coalesce(excluded.set_type, t.set_type),
       released_at = coalesce(excluded.released_at, t.released_at),
       digital = coalesce(excluded.digital, t.digital),
       updated_at = now()
     where t.name is distinct from excluded.name
        or t.scryfall_id is distinct from excluded.scryfall_id
        or t.set_type is distinct from excluded.set_type
        or t.released_at is distinct from excluded.released_at
        or t.digital is distinct from excluded.digital
     returning id`,
    [s.scryfallId, s.code, s.name, s.setType, s.releasedAt, s.digital],
  );

  if (result.rows[0]) return result.rows[0].id;

  const existing = await client.query<{ id: string }>(
    `select id from catalog.set where code = $1`,
    [s.code],
  );
  return existing.rows[0].id;
};

const upsertCard = async (client: PoolClient, record: CanonicalRecord): Promise<string> => {
  const c = record.card;
  const result = await client.query<{ id: string }>(
    `insert into catalog.card as t
       (oracle_id, name, mana_cost, mana_value, type_line, oracle_text,
        colors, color_identity, keywords, legalities, layout, reserved,
        edhrec_rank, is_game_changer, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, now())
     on conflict (oracle_id) do update set
       name = excluded.name,
       mana_cost = excluded.mana_cost,
       mana_value = excluded.mana_value,
       type_line = excluded.type_line,
       oracle_text = excluded.oracle_text,
       colors = excluded.colors,
       color_identity = excluded.color_identity,
       keywords = excluded.keywords,
       legalities = excluded.legalities,
       layout = excluded.layout,
       reserved = excluded.reserved,
       edhrec_rank = excluded.edhrec_rank,
       is_game_changer = coalesce(excluded.is_game_changer, t.is_game_changer),
       updated_at = now()
     where t.name is distinct from excluded.name
        or t.mana_cost is distinct from excluded.mana_cost
        or t.mana_value is distinct from excluded.mana_value
        or t.type_line is distinct from excluded.type_line
        or t.oracle_text is distinct from excluded.oracle_text
        or t.colors is distinct from excluded.colors
        or t.color_identity is distinct from excluded.color_identity
        or t.keywords is distinct from excluded.keywords
        or t.legalities is distinct from excluded.legalities
        or t.layout is distinct from excluded.layout
        or t.reserved is distinct from excluded.reserved
        or t.edhrec_rank is distinct from excluded.edhrec_rank
        or t.is_game_changer is distinct from coalesce(excluded.is_game_changer, t.is_game_changer)
     returning id`,
    [
      c.oracleId,
      c.name,
      c.manaCost,
      c.manaValue,
      c.typeLine,
      c.oracleText,
      c.colors,
      c.colorIdentity,
      c.keywords,
      JSON.stringify(c.legalities),
      c.layout,
      c.reserved,
      c.edhrecRank,
      c.isGameChanger,
    ],
  );

  if (result.rows[0]) return result.rows[0].id;

  const existing = await client.query<{ id: string }>(
    `select id from catalog.card where oracle_id = $1`,
    [c.oracleId],
  );
  return existing.rows[0].id;
};

type PrintingWrite = { id: string; changed: boolean; inserted: boolean };

const upsertPrinting = async (
  client: PoolClient,
  cardId: string,
  setId: string,
  record: CanonicalRecord,
): Promise<PrintingWrite> => {
  const p = record.printing;
  const existing = await client.query<{ id: string }>(
    `select id from catalog.printing where scryfall_id = $1`,
    [p.scryfallId],
  );

  if (!existing.rowCount) {
    const inserted = await client.query<{ id: string }>(
      `insert into catalog.printing
         (card_id, set_id, scryfall_id, collector_number, language, rarity, artist,
          released_at, border_color, frame, full_art, textless, oversized, promo, reprint,
          finishes, image_small, image_normal, image_large, image_png, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, now())
       returning id`,
      [
        cardId,
        setId,
        p.scryfallId,
        p.collectorNumber,
        p.language,
        p.rarity,
        p.artist,
        p.releasedAt,
        p.borderColor,
        p.frame,
        p.fullArt,
        p.textless,
        p.oversized,
        p.promo,
        p.reprint,
        p.finishes,
        p.imageSmall,
        p.imageNormal,
        p.imageLarge,
        p.imagePng,
      ],
    );
    return { id: inserted.rows[0].id, changed: true, inserted: true };
  }

  const printingId = existing.rows[0].id;
  const updated = await client.query<{ id: string }>(
    `update catalog.printing set
       card_id = $2,
       set_id = $3,
       collector_number = $4,
       language = $5,
       rarity = $6,
       artist = $7,
       released_at = $8::date,
       border_color = $9,
       frame = $10,
       full_art = $11,
       textless = $12,
       oversized = $13,
       promo = $14,
       reprint = $15,
       finishes = $16,
       image_small = $17,
       image_normal = $18,
       image_large = $19,
       image_png = $20,
       updated_at = now()
     where id = $1
       and (
         card_id is distinct from $2
         or set_id is distinct from $3
         or collector_number is distinct from $4
         or language is distinct from $5
         or rarity is distinct from $6
         or artist is distinct from $7
         or released_at is distinct from $8::date
         or border_color is distinct from $9
         or frame is distinct from $10
         or full_art is distinct from $11
         or textless is distinct from $12
         or oversized is distinct from $13
         or promo is distinct from $14
         or reprint is distinct from $15
         or finishes is distinct from $16
         or image_small is distinct from $17
         or image_normal is distinct from $18
         or image_large is distinct from $19
         or image_png is distinct from $20
       )
     returning id`,
    [
      printingId,
      cardId,
      setId,
      p.collectorNumber,
      p.language,
      p.rarity,
      p.artist,
      p.releasedAt,
      p.borderColor,
      p.frame,
      p.fullArt,
      p.textless,
      p.oversized,
      p.promo,
      p.reprint,
      p.finishes,
      p.imageSmall,
      p.imageNormal,
      p.imageLarge,
      p.imagePng,
    ],
  );

  return {
    id: printingId,
    changed: (updated.rowCount ?? 0) > 0,
    inserted: false,
  };
};

const replaceFaces = async (
  client: PoolClient,
  printingId: string,
  record: CanonicalRecord,
): Promise<void> => {
  await client.query(`delete from catalog.card_face where printing_id = $1`, [printingId]);
  for (const face of record.faces) {
    await client.query(
      `insert into catalog.card_face
         (printing_id, face_index, name, mana_cost, type_line, oracle_text, colors,
          power, toughness, loyalty, defense, image_normal, image_large)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        printingId,
        face.faceIndex,
        face.name,
        face.manaCost,
        face.typeLine,
        face.oracleText,
        face.colors,
        face.power,
        face.toughness,
        face.loyalty,
        face.defense,
        face.imageNormal,
        face.imageLarge,
      ],
    );
  }
};

const upsertIdentifiers = async (
  client: PoolClient,
  printingId: string,
  record: CanonicalRecord,
): Promise<void> => {
  for (const id of record.identifiers) {
    await client.query(
      `insert into catalog.printing_identifier (printing_id, provider, external_id, updated_at)
       values ($1, $2, $3, now())
       on conflict (provider, external_id) do update set
         printing_id = excluded.printing_id,
         updated_at = now()
       where catalog.printing_identifier.printing_id is distinct from excluded.printing_id`,
      [printingId, id.provider, id.externalId],
    );
  }
};

/**
 * Upsert one Scryfall-derived catalog graph. Returns printing-level change accounting.
 */
export const upsertCatalogRecord = async (
  client: PoolClient,
  record: CanonicalRecord,
): Promise<CatalogUpsertResult> => {
  const setId = await upsertSet(client, record);
  const cardId = await upsertCard(client, record);
  const printing = await upsertPrinting(client, cardId, setId, record);

  // Faces/identifiers always reconciled; cheap relative to download.
  await replaceFaces(client, printing.id, record);
  await upsertIdentifiers(client, printing.id, record);

  if (printing.inserted) return { inserted: 1, updated: 0, unchanged: 0 };
  if (printing.changed) return { inserted: 0, updated: 1, unchanged: 0 };
  return { inserted: 0, updated: 0, unchanged: 1 };
};

export const upsertCatalogRecords = async (
  client: PoolClient,
  records: CanonicalRecord[],
): Promise<CatalogUpsertResult> => {
  const totals: CatalogUpsertResult = { inserted: 0, updated: 0, unchanged: 0 };
  for (const record of records) {
    const result = await upsertCatalogRecord(client, record);
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
  }
  return totals;
};
