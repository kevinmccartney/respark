import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DATABASE, type Database } from '../db/database.module';
import {
  CARD_SEARCH_DEFAULT_LIMIT,
  CARD_SEARCH_DEFAULT_SORT,
  leadershipSkillsSchema,
  type CardDetail,
  type CardLegalities,
  type CardNameSuggestion,
  type CardPrintingSummary,
  type CardSearchPage,
  type CardSearchResult,
  type CardSearchSort,
  type LeadershipSkills,
} from 'schemas/cards';
import {
  recommendationDownweightKindSchema,
  type RecommendationDownweightFlag,
} from 'schemas/recommendations';
import { parseCardFaces } from 'schemas/primitives';
import type { ColorIdentityPip, DeckFormat } from 'schemas/decks';
import { bestPrintingOrderSql, printingFacesJsonSql } from '../catalog/printings';

type SearchRow = {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  mana_value: string | null;
  type_line: string | null;
  oracle_text: string | null;
  keywords: string[] | null;
  color_identity: string[] | null;
  image_normal: string | null;
  edhrec_rank: number | null;
  edhrec_saltiness: string | number | null;
  is_game_changer: boolean | null;
  downweight_kind: string | null;
  downweight_note: string | null;
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
  legalities: CardLegalities | null;
  leadership_skills: LeadershipSkills | null;
  edhrec_rank: number | null;
  edhrec_saltiness: string | number | null;
  is_game_changer: boolean | null;
  downweight_kind: string | null;
  downweight_note: string | null;
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
  finishes: string[] | null;
  faces: unknown;
};

@Injectable()
export class CardsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    @InjectPinoLogger(CardsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async search(opts: {
    q?: string;
    legalIn?: DeckFormat;
    colorIdentity?: ColorIdentityPip[];
    commanderEligible?: boolean;
    typeContains?: string;
    maxManaValue?: number;
    excludeCardIds?: string[];
    sort?: CardSearchSort;
    limit?: number;
    page?: number;
  }): Promise<CardSearchPage> {
    const q = (opts.q ?? '').trim();
    const pageSize = opts.limit ?? CARD_SEARCH_DEFAULT_LIMIT;
    const requestedPage = opts.page ?? 1;
    const sort = opts.sort ?? CARD_SEARCH_DEFAULT_SORT;

    const pattern = q.length > 0 ? `%${escapeIlike(q)}%` : null;
    const matchPredicate = matchSql(pattern);
    const legalPredicate = legalInSql(opts.legalIn);
    const identityPredicate = colorIdentitySql(opts.colorIdentity);
    const commanderPredicate = commanderEligibleSql(opts.commanderEligible);
    const typePredicate = typeContainsSql(opts.typeContains);
    const manaPredicate = maxManaValueSql(opts.maxManaValue);
    const excludePredicate = excludeCardIdsSql(opts.excludeCardIds);

    const countResult = await this.db.execute<CountRow>(sql`
      SELECT count(*)::int AS total
      FROM catalog.card c
      WHERE ${matchPredicate}
        AND ${legalPredicate}
        AND ${identityPredicate}
        AND ${commanderPredicate}
        AND ${typePredicate}
        AND ${manaPredicate}
        AND ${excludePredicate}
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const orderSql = searchOrderSql({
      namePattern: pattern,
      sort,
    });

    const pageResult = await this.db.execute<SearchRow>(sql`
      WITH matched AS (
        SELECT
          c.id,
          c.oracle_id,
          c.name,
          c.mana_cost,
          c.mana_value::text AS mana_value,
          c.type_line,
          c.oracle_text,
          c.keywords,
          c.color_identity,
          c.edhrec_rank,
          c.edhrec_saltiness,
          c.is_game_changer,
          dw.kind AS downweight_kind,
          dw.note AS downweight_note
        FROM catalog.card c
        LEFT JOIN app.recommendation_downweight dw ON dw.card_id = c.id
        WHERE ${matchPredicate}
          AND ${legalPredicate}
          AND ${identityPredicate}
          AND ${commanderPredicate}
          AND ${typePredicate}
          AND ${manaPredicate}
          AND ${excludePredicate}
        ORDER BY ${orderSql}
        LIMIT ${pageSize}
        OFFSET ${offset}
      )
      SELECT
        m.id,
        m.oracle_id,
        m.name,
        m.mana_cost,
        m.mana_value,
        m.type_line,
        m.oracle_text,
        m.keywords,
        m.color_identity,
        m.edhrec_rank,
        m.edhrec_saltiness,
        m.is_game_changer,
        m.downweight_kind,
        m.downweight_note,
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
      ORDER BY ${searchOrderSql({
        namePattern: pattern,
        sort,
        tableAlias: 'm',
      })}
    `);

    const cards = pageResult.rows.map(toCard);

    this.logger.info(
      {
        event: 'cards.search',
        q: q || null,
        qLength: q.length,
        legalIn: opts.legalIn ?? null,
        colorIdentity: opts.colorIdentity?.join('') ?? null,
        commanderEligible: opts.commanderEligible ?? null,
        sort,
        typeContains: opts.typeContains ?? null,
        maxManaValue: opts.maxManaValue ?? null,
        excludeCount: opts.excludeCardIds?.length ?? 0,
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
  async suggestNames(
    qRaw: string | undefined,
    opts?: {
      limit?: number;
      legalIn?: DeckFormat;
      colorIdentity?: ColorIdentityPip[];
      commanderEligible?: boolean;
    },
  ): Promise<CardNameSuggestion[]> {
    const q = (qRaw ?? '').trim();
    if (q.length < 2) return [];

    const limit = opts?.limit ?? 15;
    const pattern = `%${escapeIlike(q)}%`;
    const legalPredicate = legalInSql(opts?.legalIn);
    const identityPredicate = colorIdentitySql(opts?.colorIdentity);
    const commanderPredicate = commanderEligibleSql(opts?.commanderEligible);

    const result = await this.db.execute<{ id: string; name: string }>(sql`
      SELECT c.id, c.name
      FROM catalog.card c
      WHERE c.name ILIKE ${pattern} ESCAPE '\\'
        AND ${legalPredicate}
        AND ${identityPredicate}
        AND ${commanderPredicate}
      ORDER BY c.name ASC
      LIMIT ${limit}
    `);

    return result.rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async findIdByExactName(name: string): Promise<{ id: string; name: string } | null> {
    const result = await this.db.execute<{ id: string; name: string }>(sql`
      SELECT c.id, c.name
      FROM catalog.card c
      WHERE lower(c.name) = lower(${name.trim()})
      LIMIT 2
    `);
    if (result.rows.length !== 1) return null;
    return result.rows[0];
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
        c.legalities,
        c.leadership_skills,
        c.layout,
        c.reserved,
        c.edhrec_rank,
        c.edhrec_saltiness,
        c.is_game_changer,
        dw.kind AS downweight_kind,
        dw.note AS downweight_note
      FROM catalog.card c
      LEFT JOIN app.recommendation_downweight dw ON dw.card_id = c.id
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
        f.image_large AS face_image_large,
        p.finishes,
        ${printingFacesJsonSql} AS faces
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
      legalities: parseLegalities(cardRow.legalities),
      leadershipSkills: parseLeadershipSkills(cardRow.leadership_skills),
      layout: cardRow.layout,
      reserved: cardRow.reserved,
      edhrecRank: cardRow.edhrec_rank,
      edhrecSaltiness: parseNullableNumber(cardRow.edhrec_saltiness),
      isGameChanger: cardRow.is_game_changer,
      downweight: toDownweight(cardRow.downweight_kind, cardRow.downweight_note),
      printings,
    };
  }
}

const legalInSql = (legalIn: DeckFormat | undefined): SQL => {
  if (!legalIn) return sql`TRUE`;
  return sql`(c.legalities ->> ${legalIn}) = 'legal'`;
};

const commanderEligibleSql = (enabled: boolean | undefined): SQL => {
  if (!enabled) return sql`TRUE`;
  return sql`(c.leadership_skills ->> 'commander') = 'true'`;
};

const colorIdentitySql = (colorIdentity: ColorIdentityPip[] | undefined): SQL => {
  if (!colorIdentity) return sql`TRUE`;
  if (colorIdentity.length === 0) {
    return sql`coalesce(cardinality(c.color_identity), 0) = 0`;
  }
  return sql`coalesce(c.color_identity, ARRAY[]::text[]) <@ ARRAY[${sql.join(
    colorIdentity.map((pip) => sql`${pip}`),
    sql`, `,
  )}]::text[]`;
};

const typeContainsSql = (typeContains: string | undefined): SQL => {
  const q = typeContains?.trim();
  if (!q) return sql`TRUE`;
  const pattern = `%${escapeIlike(q)}%`;
  return sql`c.type_line ILIKE ${pattern} ESCAPE '\\'`;
};

const maxManaValueSql = (maxManaValue: number | undefined): SQL => {
  if (maxManaValue === undefined) return sql`TRUE`;
  return sql`c.mana_value IS NOT NULL AND c.mana_value <= ${maxManaValue}`;
};

const excludeCardIdsSql = (excludeCardIds: string[] | undefined): SQL => {
  if (!excludeCardIds || excludeCardIds.length === 0) return sql`TRUE`;
  return sql`c.id NOT IN (${sql.join(
    excludeCardIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
};

const parseLegalities = (raw: CardLegalities | null): CardLegalities | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw;
};

const parseLeadershipSkills = (raw: LeadershipSkills | null): LeadershipSkills | null => {
  const parsed = leadershipSkillsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

const searchOrderSql = (opts: {
  namePattern: string | null;
  sort: CardSearchSort;
  tableAlias?: 'c' | 'm';
}): SQL => {
  const nameCol = opts.tableAlias === 'm' ? sql`m.name` : sql`c.name`;
  const rankCol = opts.tableAlias === 'm' ? sql`m.edhrec_rank` : sql`c.edhrec_rank`;
  const idCol = opts.tableAlias === 'm' ? sql`m.id` : sql`c.id`;
  const nameMatch = opts.namePattern
    ? sql`(${nameCol} ILIKE ${opts.namePattern} ESCAPE '\\') DESC,`
    : sql``;
  const requested =
    opts.sort === 'edhrecRank'
      ? sql`${rankCol} ASC NULLS LAST, ${nameCol} ASC,`
      : sql`${nameCol} ASC,`;
  return sql`${nameMatch} ${requested} ${idCol} ASC`;
};

const parseNullableNumber = (value: string | number | null): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toDownweight = (
  kind: string | null,
  note: string | null,
): RecommendationDownweightFlag | null => {
  const parsed = recommendationDownweightKindSchema.safeParse(kind);
  if (!parsed.success) return null;
  return { kind: parsed.data, note };
};

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
  manaValue: row.mana_value,
  typeLine: row.type_line,
  oracleText: row.oracle_text,
  keywords: row.keywords,
  colorIdentity: row.color_identity,
  imageNormal: row.image_normal,
  edhrecRank: row.edhrec_rank,
  edhrecSaltiness: parseNullableNumber(row.edhrec_saltiness),
  isGameChanger: row.is_game_changer,
  downweight: toDownweight(row.downweight_kind, row.downweight_note),
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
  finishes: row.finishes ?? [],
  faces: parseCardFaces(row.faces),
});
