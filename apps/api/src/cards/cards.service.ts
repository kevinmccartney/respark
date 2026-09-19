import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DATABASE, type Database } from '../db/database.module';
import {
  CARD_SEARCH_DEFAULT_LIMIT,
  type CardDetail,
  type CardNameSuggestion,
  type CardPrintingSummary,
  type CardSearchPage,
  type CardSearchResult,
} from 'schemas/cards';
import { bestPrintingOrderSql } from '../catalog/printings';

type SearchRow = {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string | null;
  oracle_text: string | null;
  image_normal: string | null;
};

type CountRow = {
  total: string | number;
};

type CardDetailRow = {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  mana_value: string | null;
  type_line: string | null;
  oracle_text: string | null;
  colors: string[] | null;
  color_identity: string[] | null;
  keywords: string[] | null;
  layout: string | null;
  reserved: boolean | null;
};

type PrintingDetailRow = {
  id: string;
  scryfall_id: string;
  collector_number: string;
  language: string | null;
  rarity: string | null;
  artist: string | null;
  released_at: string | null;
  set_code: string;
  set_name: string;
  image_normal: string | null;
  image_large: string | null;
  face_image_normal: string | null;
  face_image_large: string | null;
};

@Injectable()
export class CardsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(CardsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async search(opts: { q?: string; limit?: number; page?: number }): Promise<CardSearchPage> {
    const q = (opts.q ?? '').trim();
    const pageSize = opts.limit ?? CARD_SEARCH_DEFAULT_LIMIT;
    const requestedPage = opts.page ?? 1;

    const pattern = q.length > 0 ? `%${escapeIlike(q)}%` : null;
    const matchPredicate = matchSql(pattern);

    const countResult = await this.db.execute<CountRow>(sql`
      SELECT count(*)::int AS total
      FROM catalog.card c
      WHERE ${matchPredicate}
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const pageResult = await this.db.execute<SearchRow>(sql`
      WITH matched AS (
        SELECT
          c.id,
          c.oracle_id,
          c.name,
          c.mana_cost,
          c.type_line,
          c.oracle_text
        FROM catalog.card c
        WHERE ${matchPredicate}
        ORDER BY c.name ASC, c.id ASC
        LIMIT ${pageSize}
        OFFSET ${offset}
      )
      SELECT
        m.id,
        m.oracle_id,
        m.name,
        m.mana_cost,
        m.type_line,
        m.oracle_text,
        COALESCE(img.image_normal, img.face_image_normal) AS image_normal
      FROM matched m
      LEFT JOIN LATERAL (
        SELECT
          p.image_normal,
          f.image_normal AS face_image_normal
        FROM catalog.printing p
        LEFT JOIN catalog.card_face f
          ON f.printing_id = p.id AND f.face_index = 0
        WHERE p.card_id = m.id
        ORDER BY ${bestPrintingOrderSql}
        LIMIT 1
      ) img ON true
      ORDER BY m.name ASC, m.id ASC
    `);

    const cards = pageResult.rows.map(toCard);

    this.logger.info(
      {
        event: 'cards.search',
        qLength: q.length,
        page,
        pageSize,
        resultCount: cards.length,
        total,
        totalPages,
      },
      'Searched cards',
    );

    return { cards, total, page, pageSize, totalPages };
  }

  /**
   * Deck-builder autocomplete: match card names only, return id + name.
   */
  async suggestNames(qRaw: string | undefined, limitRaw?: number): Promise<CardNameSuggestion[]> {
    const q = (qRaw ?? '').trim();
    if (q.length < 2) return [];

    const limit = limitRaw ?? 15;
    const pattern = `%${escapeIlike(q)}%`;

    const result = await this.db.execute<{ id: string; name: string }>(sql`
      SELECT c.id, c.name
      FROM catalog.card c
      WHERE c.name ILIKE ${pattern} ESCAPE '\\'
      ORDER BY c.name ASC
      LIMIT ${limit}
    `);

    return result.rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async getById(id: string): Promise<CardDetail> {
    const cardResult = await this.db.execute<CardDetailRow>(sql`
      SELECT
        c.id,
        c.oracle_id,
        c.name,
        c.mana_cost,
        c.mana_value::text AS mana_value,
        c.type_line,
        c.oracle_text,
        c.colors,
        c.color_identity,
        c.keywords,
        c.layout,
        c.reserved
      FROM catalog.card c
      WHERE c.id = ${id}::uuid
      LIMIT 1
    `);

    const cardRow = cardResult.rows[0];
    if (!cardRow) {
      throw new NotFoundException('Card not found');
    }

    const printingResult = await this.db.execute<PrintingDetailRow>(sql`
      SELECT
        p.id,
        p.scryfall_id,
        p.collector_number,
        p.language,
        p.rarity,
        p.artist,
        p.released_at::text AS released_at,
        s.code AS set_code,
        s.name AS set_name,
        p.image_normal,
        p.image_large,
        f.image_normal AS face_image_normal,
        f.image_large AS face_image_large
      FROM catalog.printing p
      JOIN catalog.set s ON s.id = p.set_id
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE p.card_id = ${id}::uuid
      ORDER BY p.released_at DESC NULLS LAST, s.code ASC, p.collector_number ASC
    `);

    const printings = printingResult.rows.map(toPrinting);

    this.logger.info(
      {
        event: 'cards.get',
        cardId: id,
        printingCount: printings.length,
      },
      'Fetched card detail',
    );

    return {
      id: cardRow.id,
      oracleId: cardRow.oracle_id,
      name: cardRow.name,
      manaCost: cardRow.mana_cost,
      manaValue: cardRow.mana_value,
      typeLine: cardRow.type_line,
      oracleText: cardRow.oracle_text,
      colors: cardRow.colors,
      colorIdentity: cardRow.color_identity,
      keywords: cardRow.keywords,
      layout: cardRow.layout,
      reserved: cardRow.reserved,
      printings,
    };
  }
}

const matchSql = (pattern: string | null): SQL => sql`
    (
      ${pattern}::text IS NULL
      OR c.name ILIKE ${pattern} ESCAPE '\\'
      OR c.type_line ILIKE ${pattern} ESCAPE '\\'
      OR c.oracle_text ILIKE ${pattern} ESCAPE '\\'
      OR c.mana_cost ILIKE ${pattern} ESCAPE '\\'
      OR catalog.immutable_array_to_string(c.keywords, ' ') ILIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1
        FROM catalog.printing p
        JOIN catalog.card_face f ON f.printing_id = p.id
        WHERE p.card_id = c.id
          AND (
            f.name ILIKE ${pattern} ESCAPE '\\'
            OR f.type_line ILIKE ${pattern} ESCAPE '\\'
            OR f.oracle_text ILIKE ${pattern} ESCAPE '\\'
          )
      )
    )
  `;

const escapeIlike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const toCard = (row: SearchRow): CardSearchResult => ({
  id: row.id,
  oracleId: row.oracle_id,
  name: row.name,
  manaCost: row.mana_cost,
  typeLine: row.type_line,
  oracleText: row.oracle_text,
  imageNormal: row.image_normal,
});

const toPrinting = (row: PrintingDetailRow): CardPrintingSummary => ({
  id: row.id,
  scryfallId: row.scryfall_id,
  collectorNumber: row.collector_number,
  language: row.language,
  rarity: row.rarity,
  artist: row.artist,
  releasedAt: row.released_at,
  setCode: row.set_code,
  setName: row.set_name,
  imageNormal: row.image_normal ?? row.face_image_normal,
  imageLarge: row.image_large ?? row.face_image_large ?? row.image_normal ?? row.face_image_normal,
});
