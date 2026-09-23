import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { SortDir } from '@respark/schemas/primitives';
import {
  SET_PRINTINGS_DEFAULT_LIMIT,
  SET_PRINTING_DEFAULT_SORT,
  SET_SEARCH_DEFAULT_LIMIT,
  SET_SEARCH_DEFAULT_SORT,
  SET_TYPE_SUGGESTIONS_DEFAULT_LIMIT,
  defaultSetPrintingSortDir,
  defaultSetSortDir,
  type SetDetail,
  type SetListItem,
  type SetPrintingSort,
  type SetSearchPage,
  type SetSearchSort,
} from '@respark/schemas/sets';

import { DATABASE, type Database } from '../db/database.module';

type CountRow = {
  total: string | number;
};

type SetRow = {
  id: string;
  scryfall_id: string | null;
  code: string;
  name: string;
  set_type: string | null;
  block: string | null;
  block_code: string | null;
  released_at: string | null;
  card_count: number | null;
  parent_set_code: string | null;
  icon_svg_uri: string | null;
};

type PrintingRow = {
  id: string;
  card_id: string;
  card_name: string;
  collector_number: string;
  rarity: string | null;
  image_normal: string | null;
};

@Injectable()
export class SetsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(SetsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async search(opts: {
    q?: string;
    setType?: string | string[];
    sort?: SetSearchSort;
    dir?: SortDir;
    limit?: number;
    page?: number;
  }): Promise<SetSearchPage> {
    const q = (opts.q ?? '').trim();
    const pageSize = opts.limit ?? SET_SEARCH_DEFAULT_LIMIT;
    const requestedPage = opts.page ?? 1;
    const sort = opts.sort ?? SET_SEARCH_DEFAULT_SORT;
    const dir = opts.dir ?? defaultSetSortDir(sort);

    const pattern = q.length > 0 ? `%${escapeIlike(q)}%` : null;
    const matchPredicate = matchSql(pattern);
    const typePredicate = setTypeSql(opts.setType);
    const orderSql = searchOrderSql(sort, dir);

    const countResult = await this.db.execute<CountRow>(sql`
      SELECT count(*)::int AS total
      FROM catalog.set s
      WHERE ${matchPredicate}
        AND ${typePredicate}
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const pageResult = await this.db.execute<SetRow>(sql`
      SELECT
        s.id,
        s.scryfall_id::text AS scryfall_id,
        s.code,
        s.name,
        s.set_type,
        s.released_at::text AS released_at,
        (
          SELECT count(*)::int
          FROM catalog.printing p
          WHERE p.set_id = s.id
        ) AS card_count,
        s.parent_set_code,
        s.icon_svg_uri
      FROM catalog.set s
      WHERE ${matchPredicate}
        AND ${typePredicate}
      ORDER BY ${orderSql}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    const sets = pageResult.rows.map(toListItem);

    this.logger.info(
      {
        event: 'sets.search',
        q: q || null,
        setType: opts.setType ?? null,
        sort,
        dir,
        page,
        pageSize,
        resultCount: sets.length,
        total,
        totalPages,
      },
      'Searched sets',
    );

    return { sets, total, page, pageSize, totalPages };
  }

  /**
   * Distinct `set_type` values from the catalog for bounded autocomplete.
   * Empty `q` returns the full (small) vocabulary.
   */
  async suggestSetTypes(qRaw: string | undefined, opts?: { limit?: number }): Promise<string[]> {
    const q = (qRaw ?? '').trim();
    const limit = opts?.limit ?? SET_TYPE_SUGGESTIONS_DEFAULT_LIMIT;
    const prefixPattern = q.length > 0 ? `${escapeIlike(q)}%` : null;

    const result = await this.db.execute<{ set_type: string }>(
      prefixPattern
        ? sql`
            SELECT DISTINCT s.set_type
            FROM catalog.set s
            WHERE s.set_type IS NOT NULL
              AND s.set_type <> ''
              AND s.set_type ILIKE ${prefixPattern} ESCAPE '\\'
            ORDER BY s.set_type ASC
            LIMIT ${limit}
          `
        : sql`
            SELECT DISTINCT s.set_type
            FROM catalog.set s
            WHERE s.set_type IS NOT NULL
              AND s.set_type <> ''
            ORDER BY s.set_type ASC
            LIMIT ${limit}
          `,
    );

    return result.rows.map((row) => row.set_type);
  }

  async getById(
    id: string,
    opts?: { sort?: SetPrintingSort; dir?: SortDir; limit?: number; page?: number },
  ): Promise<SetDetail> {
    const pageSize = opts?.limit ?? SET_PRINTINGS_DEFAULT_LIMIT;
    const requestedPage = opts?.page ?? 1;
    const sort = opts?.sort ?? SET_PRINTING_DEFAULT_SORT;
    const dir = opts?.dir ?? defaultSetPrintingSortDir(sort);

    const setResult = await this.db.execute<SetRow>(sql`
      SELECT
        s.id,
        s.scryfall_id::text AS scryfall_id,
        s.code,
        s.name,
        s.set_type,
        s.block,
        s.block_code,
        s.released_at::text AS released_at,
        s.card_count,
        s.parent_set_code,
        s.icon_svg_uri
      FROM catalog.set s
      WHERE s.id = ${id}::uuid
      LIMIT 1
    `);
    const setRow = setResult.rows[0];
    if (!setRow) {
      throw new NotFoundException(`Set ${id} not found`);
    }

    const countResult = await this.db.execute<CountRow>(sql`
      SELECT count(*)::int AS total
      FROM catalog.printing p
      WHERE p.set_id = ${id}::uuid
    `);
    const printingsTotal = Number(countResult.rows[0]?.total ?? 0);
    const printingsTotalPages = printingsTotal === 0 ? 0 : Math.ceil(printingsTotal / pageSize);
    const printingsPage =
      printingsTotalPages === 0 ? 1 : Math.min(requestedPage, printingsTotalPages);
    const offset = (printingsPage - 1) * pageSize;

    const printingsResult = await this.db.execute<PrintingRow>(sql`
      SELECT
        p.id,
        p.card_id,
        c.name AS card_name,
        p.collector_number,
        p.rarity,
        COALESCE(p.image_normal, f.image_normal) AS image_normal
      FROM catalog.printing p
      JOIN catalog.card c ON c.id = p.card_id
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE p.set_id = ${id}::uuid
      ORDER BY ${printingOrderSql(sort, dir)}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    this.logger.info(
      {
        event: 'sets.getById',
        setId: id,
        sort,
        dir,
        printingsPage,
        printingsPageSize: pageSize,
        printingsTotal,
      },
      'Loaded set detail',
    );

    return {
      ...toListItem(setRow),
      cardCount: printingsTotal,
      parentSetCode: setRow.parent_set_code,
      block: setRow.block,
      blockCode: setRow.block_code,
      iconSvgUri: setRow.icon_svg_uri,
      printings: printingsResult.rows.map((row) => ({
        id: row.id,
        cardId: row.card_id,
        cardName: row.card_name,
        collectorNumber: row.collector_number,
        rarity: row.rarity,
        imageNormal: row.image_normal,
      })),
      printingsTotal,
      printingsPage,
      printingsPageSize: pageSize,
      printingsTotalPages,
    };
  }
}

const toListItem = (row: SetRow): SetListItem => ({
  id: row.id,
  scryfallId: row.scryfall_id,
  code: row.code,
  name: row.name,
  setType: row.set_type,
  releasedAt: row.released_at,
  cardCount: Number(row.card_count ?? 0),
});

const escapeIlike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

const matchSql = (pattern: string | null): SQL => {
  if (!pattern) return sql`TRUE`;
  return sql`(s.name ILIKE ${pattern} ESCAPE '\\' OR s.code ILIKE ${pattern} ESCAPE '\\')`;
};

const setTypeSql = (setType: string | string[] | undefined): SQL => {
  const raw = !setType ? [] : Array.isArray(setType) ? setType : [setType];
  const types = raw.map((token) => token.trim()).filter(Boolean);
  if (types.length === 0) return sql`TRUE`;
  return sql`s.set_type IN (${sql.join(
    types.map((token) => sql`${token}`),
    sql`, `,
  )})`;
};

const printingCountOrderSql = sql`(
  SELECT count(*)::int
  FROM catalog.printing p
  WHERE p.set_id = s.id
)`;

const searchOrderSql = (sort: SetSearchSort, dir: SortDir): SQL => {
  const ascending = dir === 'asc';
  switch (sort) {
    case 'code':
      return ascending ? sql`s.code ASC` : sql`s.code DESC`;
    case 'name':
      return ascending ? sql`s.name ASC` : sql`s.name DESC`;
    case 'setType':
      return ascending
        ? sql`s.set_type ASC NULLS LAST, s.name ASC`
        : sql`s.set_type DESC NULLS LAST, s.name ASC`;
    case 'cardCount':
      return ascending
        ? sql`${printingCountOrderSql} ASC, s.name ASC`
        : sql`${printingCountOrderSql} DESC, s.name ASC`;
    case 'releasedAt':
    default:
      return ascending
        ? sql`s.released_at ASC NULLS LAST, s.name ASC`
        : sql`s.released_at DESC NULLS LAST, s.name ASC`;
  }
};

const collectorNumberOrderSql = (dir: SortDir): SQL => {
  const numDir = dir === 'asc' ? sql`ASC` : sql`DESC`;
  const textDir = dir === 'asc' ? sql`ASC` : sql`DESC`;
  return sql`
    NULLIF(regexp_replace(p.collector_number, '[^0-9].*$', ''), '')::int ${numDir} NULLS LAST,
    p.collector_number ${textDir},
    c.name ASC
  `;
};

const printingOrderSql = (sort: SetPrintingSort, dir: SortDir): SQL => {
  switch (sort) {
    case 'name':
      return dir === 'asc'
        ? sql`c.name ASC, p.collector_number ASC`
        : sql`c.name DESC, p.collector_number ASC`;
    case 'rarity':
      return dir === 'asc'
        ? sql`p.rarity ASC NULLS LAST, c.name ASC`
        : sql`p.rarity DESC NULLS LAST, c.name ASC`;
    case 'collectorNumber':
    default:
      return collectorNumberOrderSql(dir);
  }
};
