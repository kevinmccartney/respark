import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { parseScryfallQuery, ScryfallQueryError } from 'scryfall-query';
import { DATABASE, type Database } from '../db/database.module';
import {
  CARD_SEARCH_DEFAULT_LIMIT,
  CARD_SEARCH_DEFAULT_SORT,
  CARD_TYPE_SUGGESTIONS_DEFAULT_LIMIT,
  defaultCardSortDir,
  leadershipSkillsSchema,
  type CardDetail,
  type CardLegalities,
  type CardNameSuggestion,
  type CardPrintingSummary,
  type CardSearchColorFilter,
  type CardSearchPage,
  type CardSearchRarity,
  type CardSearchResult,
  type CardSearchSort,
  type LeadershipSkills,
} from 'schemas/cards';
import type { SortDir } from 'schemas/primitives';
import { goodstuffTagSchema, type RecommendationGoodstuffFlag } from 'schemas/recommendations';
import { parseCardFaces, uuidSchema } from 'schemas/primitives';
import type { ColorIdentityPip, DeckFormat } from 'schemas/decks';
import { bestPrintingOrderSql, printingFacesJsonSql } from '../catalog/printings';
import { compileScryfallAst } from './scryfall-sql';

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
  legalities: CardLegalities | null;
  image_normal: string | null;
  rarity: string | null;
  edhrec_rank: number | null;
  edhrec_saltiness: string | number | null;
  is_game_changer: boolean | null;
  goodstuff_tags: string[] | null;
  goodstuff_note: string | null;
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
  goodstuff_tags: string[] | null;
  goodstuff_note: string | null;
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
    scryfall?: string;
    legalIn?: DeckFormat | DeckFormat[];
    colorIdentity?: CardSearchColorFilter[];
    includeColorless?: boolean;
    commanderEligible?: boolean;
    typeContains?: string | string[];
    rarity?: CardSearchRarity[];
    maxManaValue?: number;
    excludeCardIds?: string[];
    sort?: CardSearchSort;
    dir?: SortDir;
    limit?: number;
    page?: number;
  }): Promise<CardSearchPage> {
    const q = (opts.q ?? '').trim();
    const scryfallQ = (opts.scryfall ?? '').trim();
    const pageSize = opts.limit ?? CARD_SEARCH_DEFAULT_LIMIT;
    const requestedPage = opts.page ?? 1;
    const sort = opts.sort ?? CARD_SEARCH_DEFAULT_SORT;
    const dir = opts.dir ?? defaultCardSortDir(sort);

    let scryfallPredicate: SQL = sql`TRUE`;
    if (scryfallQ) {
      try {
        scryfallPredicate = compileScryfallAst(parseScryfallQuery(scryfallQ));
      } catch (err) {
        if (err instanceof ScryfallQueryError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }

    const pattern = q.length > 0 ? `%${escapeIlike(q)}%` : null;
    const matchPredicate = matchSql(pattern);
    const legalPredicate = legalInSql(opts.legalIn);
    const identityPredicate = colorIdentitySql(opts.colorIdentity, opts.includeColorless);
    const commanderPredicate = commanderEligibleSql(opts.commanderEligible);
    const typePredicate = typeContainsSql(opts.typeContains);
    const rarityPredicate = raritySql(opts.rarity);
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
        AND ${rarityPredicate}
        AND ${manaPredicate}
        AND ${excludePredicate}
        AND ${scryfallPredicate}
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const orderSql = searchOrderSql({
      namePattern: pattern,
      sort,
      dir,
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
          c.legalities,
          c.edhrec_rank,
          c.edhrec_saltiness,
          c.is_game_changer,
          CASE WHEN g.card_id IS NULL THEN NULL ELSE gt.tags END AS goodstuff_tags,
          g.note AS goodstuff_note
        FROM catalog.card c
        LEFT JOIN app.recommendation_goodstuff g ON g.card_id = c.id
        LEFT JOIN LATERAL (
          SELECT COALESCE(array_agg(t.tag ORDER BY t.tag), ARRAY[]::text[]) AS tags
          FROM app.recommendation_goodstuff_tag t
          WHERE t.card_id = c.id
        ) gt ON g.card_id IS NOT NULL
        WHERE ${matchPredicate}
          AND ${legalPredicate}
          AND ${identityPredicate}
          AND ${commanderPredicate}
          AND ${typePredicate}
          AND ${rarityPredicate}
          AND ${manaPredicate}
          AND ${excludePredicate}
          AND ${scryfallPredicate}
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
        m.legalities,
        m.edhrec_rank,
        m.edhrec_saltiness,
        m.is_game_changer,
        m.goodstuff_tags,
        m.goodstuff_note,
        COALESCE(img.image_normal, img.face_image_normal) AS image_normal,
        img.rarity
      FROM matched m
      LEFT JOIN LATERAL (
        SELECT
          p.image_normal,
          p.rarity,
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
        dir,
        tableAlias: 'm',
      })}
    `);

    const cards = pageResult.rows.map(toCard);

    const legacyMatch =
      q.length > 0 ||
      Boolean(opts.legalIn) ||
      Boolean(opts.colorIdentity?.length) ||
      Boolean(opts.typeContains) ||
      Boolean(opts.rarity?.length) ||
      opts.maxManaValue !== undefined;

    if (legacyMatch) {
      this.logger.debug(
        {
          event: 'cards.search.legacy_filters',
          q: q || null,
          legalIn: opts.legalIn ?? null,
          colorIdentity: opts.colorIdentity?.join('') ?? null,
          typeContains: opts.typeContains ?? null,
          rarity: opts.rarity ?? null,
          maxManaValue: opts.maxManaValue ?? null,
          hasScryfall: Boolean(scryfallQ),
        },
        'GET /cards used legacy match filters; prefer scryfall',
      );
    }

    this.logger.info(
      {
        event: 'cards.search',
        q: q || null,
        qLength: q.length,
        scryfall: scryfallQ || null,
        legacyMatch,
        legalIn: opts.legalIn ?? null,
        colorIdentity: opts.colorIdentity?.join('') ?? null,
        commanderEligible: opts.commanderEligible ?? null,
        sort,
        dir,
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
      legalIn?: DeckFormat | DeckFormat[];
      colorIdentity?: CardSearchColorFilter[];
      includeColorless?: boolean;
      commanderEligible?: boolean;
    },
  ): Promise<CardNameSuggestion[]> {
    const q = (qRaw ?? '').trim();
    if (q.length < 2) return [];

    const limit = opts?.limit ?? 15;
    const pattern = `%${escapeIlike(q)}%`;
    const legalPredicate = legalInSql(opts?.legalIn);
    const identityPredicate = colorIdentitySql(opts?.colorIdentity, opts?.includeColorless);
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

  /**
   * Type-filter autocomplete: distinct tokens from catalog type lines.
   */
  async suggestTypes(qRaw: string | undefined, opts?: { limit?: number }): Promise<string[]> {
    const q = (qRaw ?? '').trim();
    if (q.length < 1) return [];

    const limit = opts?.limit ?? CARD_TYPE_SUGGESTIONS_DEFAULT_LIMIT;
    const prefixPattern = `${escapeIlike(q)}%`;
    const containsPattern = `%${escapeIlike(q)}%`;

    // Split on whitespace after turning em/en dashes, slashes, and hyphens into spaces.
    // Use [[:space:]]+ (not \s) so the pattern survives JS template-literal cooking.
    const result = await this.db.execute<{ token: string }>(sql`
      SELECT DISTINCT token
      FROM (
        SELECT trim(both FROM unnest(
          regexp_split_to_array(
            regexp_replace(c.type_line, '[—–/-]+', ' ', 'g'),
            '[[:space:]]+'
          )
        )) AS token
        FROM catalog.card c
        WHERE c.type_line IS NOT NULL
          AND c.type_line ILIKE ${containsPattern} ESCAPE '\\'
      ) tokens
      WHERE token <> ''
        AND token !~ '^[[:punct:]]+$'
        AND token ILIKE ${prefixPattern} ESCAPE '\\'
      ORDER BY token ASC
      LIMIT ${limit}
    `);

    return result.rows.map((row) => row.token);
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

  async findByOracleIds(oracleIds: string[]): Promise<Map<string, { id: string; name: string }>> {
    const unique = [
      ...new Set(oracleIds.map((id) => id.trim()).filter((id) => uuidSchema.safeParse(id).success)),
    ];
    const out = new Map<string, { id: string; name: string }>();
    if (unique.length === 0) return out;
    const result = await this.db.execute<{ id: string; name: string; oracle_id: string }>(sql`
      SELECT c.id, c.name, c.oracle_id::text AS oracle_id
      FROM catalog.card c
      WHERE c.oracle_id IN (${sql.join(
        unique.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
    `);
    for (const row of result.rows) {
      const key = row.oracle_id.toLowerCase();
      if (!out.has(key)) {
        out.set(key, { id: row.id, name: row.name });
      }
    }
    return out;
  }

  async findIdsByExactNames(names: string[]): Promise<Map<string, string>> {
    const unique = [
      ...new Set(names.map((name) => name.trim().toLowerCase()).filter((name) => name.length > 0)),
    ];
    const out = new Map<string, string>();
    if (unique.length === 0) return out;
    const result = await this.db.execute<{ id: string; name: string }>(sql`
      SELECT c.id, c.name
      FROM catalog.card c
      WHERE lower(c.name) IN (${sql.join(
        unique.map((name) => sql`${name}`),
        sql`, `,
      )})
    `);
    const counts = new Map<string, { id: string; count: number }>();
    for (const row of result.rows) {
      const key = row.name.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      counts.set(key, { id: row.id, count: 1 });
    }
    for (const [key, value] of counts) {
      if (value.count === 1) out.set(key, value.id);
    }
    return out;
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
        CASE WHEN g.card_id IS NULL THEN NULL ELSE gt.tags END AS goodstuff_tags,
        g.note AS goodstuff_note
      FROM catalog.card c
      LEFT JOIN app.recommendation_goodstuff g ON g.card_id = c.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(t.tag ORDER BY t.tag), ARRAY[]::text[]) AS tags
        FROM app.recommendation_goodstuff_tag t
        WHERE t.card_id = c.id
      ) gt ON g.card_id IS NOT NULL
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
      goodstuff: toGoodstuff(cardRow.goodstuff_tags, cardRow.goodstuff_note),
      printings,
    };
  }
}

const legalInSql = (legalIn: DeckFormat | DeckFormat[] | undefined): SQL => {
  const formats = !legalIn ? [] : Array.isArray(legalIn) ? legalIn : [legalIn];
  if (formats.length === 0) return sql`TRUE`;
  return sql`(${sql.join(
    formats.map((format) => sql`(c.legalities ->> ${format}) = 'legal'`),
    sql` AND `,
  )})`;
};

const commanderEligibleSql = (enabled: boolean | undefined): SQL => {
  if (!enabled) return sql`TRUE`;
  return sql`(c.leadership_skills ->> 'commander') = 'true'`;
};

const colorIdentitySql = (
  colorIdentity: CardSearchColorFilter[] | undefined,
  includeColorless = true,
): SQL => {
  if (!colorIdentity || colorIdentity.length === 0) return sql`TRUE`;

  const wantColorless = colorIdentity.includes('C');
  const colors = colorIdentity.filter((pip): pip is ColorIdentityPip => pip !== 'C');

  if (colors.length === 0) {
    return sql`coalesce(cardinality(c.color_identity), 0) = 0`;
  }

  const subset = sql`coalesce(c.color_identity, ARRAY[]::text[]) <@ ARRAY[${sql.join(
    colors.map((pip) => sql`${pip}`),
    sql`, `,
  )}]::text[]`;

  // Deck building (default): colorless is legal in any color identity.
  // Admin browse with colored pips and no C: require at least one color pip.
  if (includeColorless || wantColorless) return subset;
  return sql`(${subset}) AND coalesce(cardinality(c.color_identity), 0) > 0`;
};

const typeContainsSql = (typeContains: string | string[] | undefined): SQL => {
  const raw = !typeContains ? [] : Array.isArray(typeContains) ? typeContains : [typeContains];
  const tokens = raw.map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return sql`TRUE`;
  return sql`(${sql.join(
    tokens.map((token) => {
      const pattern = `%${escapeIlike(token)}%`;
      return sql`c.type_line ILIKE ${pattern} ESCAPE '\\'`;
    }),
    sql` AND `,
  )})`;
};

/** Match the representative (best) printing rarity — same printing used for list image/rarity. */
const raritySql = (rarities: CardSearchRarity[] | undefined): SQL => {
  if (!rarities || rarities.length === 0) return sql`TRUE`;
  return sql`EXISTS (
    SELECT 1
    FROM (
      SELECT p.rarity
      FROM catalog.printing p
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE p.card_id = c.id
      ORDER BY ${bestPrintingOrderSql}
      LIMIT 1
    ) best
    WHERE best.rarity IN (${sql.join(
      rarities.map((rarity) => sql`${rarity}`),
      sql`, `,
    )})
  )`;
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
  dir: SortDir;
  tableAlias?: 'c' | 'm';
}): SQL => {
  const nameCol = opts.tableAlias === 'm' ? sql`m.name` : sql`c.name`;
  const rankCol = opts.tableAlias === 'm' ? sql`m.edhrec_rank` : sql`c.edhrec_rank`;
  // Matched CTE exposes mana_value as text for the response; cast back for numeric order.
  const manaCol = opts.tableAlias === 'm' ? sql`m.mana_value::numeric` : sql`c.mana_value`;
  const idCol = opts.tableAlias === 'm' ? sql`m.id` : sql`c.id`;
  const nameMatch = opts.namePattern
    ? sql`(${nameCol} ILIKE ${opts.namePattern} ESCAPE '\\') DESC,`
    : sql``;
  const nameOrder = opts.dir === 'asc' ? sql`${nameCol} ASC` : sql`${nameCol} DESC`;
  const rankOrder =
    opts.dir === 'asc' ? sql`${rankCol} ASC NULLS LAST` : sql`${rankCol} DESC NULLS LAST`;
  const manaOrder =
    opts.dir === 'asc' ? sql`${manaCol} ASC NULLS LAST` : sql`${manaCol} DESC NULLS LAST`;
  const requested =
    opts.sort === 'edhrecRank'
      ? sql`${rankOrder}, ${nameCol} ASC,`
      : opts.sort === 'manaValue'
        ? sql`${manaOrder}, ${nameCol} ASC,`
        : sql`${nameOrder},`;
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

const toGoodstuff = (
  tags: string[] | null,
  note: string | null,
): RecommendationGoodstuffFlag | null => {
  if (!tags || tags.length === 0) return null;
  const parsed = tags
    .map((tag) => goodstuffTagSchema.safeParse(tag))
    .filter((result) => result.success)
    .map((result) => result.data);
  if (parsed.length === 0) return null;
  return { tags: parsed, note };
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
  legalities: parseLegalities(row.legalities),
  imageNormal: row.image_normal,
  rarity: row.rarity,
  edhrecRank: row.edhrec_rank,
  edhrecSaltiness: parseNullableNumber(row.edhrec_saltiness),
  isGameChanger: row.is_game_changer,
  goodstuff: toGoodstuff(row.goodstuff_tags, row.goodstuff_note),
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
