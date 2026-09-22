import { sql, type SQL } from 'drizzle-orm';

import {
  RARITY_RANK,
  type Ast,
  type ClauseValue,
  type ColorPip,
  type ColorValue,
  type CompareOp,
  type Field,
  type ManaValue,
  type RarityName,
} from '@respark/scryfall-query';

/** Scryfall set_type values used to disambiguate `in:` (vs set codes). */
const SET_TYPES = new Set([
  'core',
  'expansion',
  'draftinnovation',
  'masters',
  'funny',
  'commander',
  'duel_deck',
  'from_the_vault',
  'spellbook',
  'premium_deck',
  'alchemy',
  'archenemy',
  'masterpiece',
  'memorabilia',
  'planechase',
  'promo',
  'starter',
  'token',
  'treasure_chest',
  'vanguard',
  'arsenal',
  'box',
  'minigame',
]);

/**
 * Compile a Scryfall-query AST to a SQL predicate over `catalog.card c`
 * (with EXISTS into printings / sets as needed).
 */
export const compileScryfallAst = (ast: Ast): SQL => compileNode(ast);

const compileNode = (ast: Ast): SQL => {
  switch (ast.type) {
    case 'and':
      return sql`(${sql.join(ast.children.map(compileNode), sql` AND `)})`;
    case 'or':
      return sql`(${sql.join(ast.children.map(compileNode), sql` OR `)})`;
    case 'not':
      return sql`(NOT (${compileNode(ast.child)}))`;
    case 'name': {
      const pattern = `%${escapeIlike(ast.text)}%`;
      return sql`c.name ILIKE ${pattern} ESCAPE '\\'`;
    }
    case 'clause':
      return compileClause(ast.field, ast.op, ast.value);
    default: {
      const _exhaustive: never = ast;
      return _exhaustive;
    }
  }
};

const compileClause = (field: Field, op: CompareOp, value: ClauseValue): SQL => {
  switch (field) {
    case 'color':
      return colorArraySql(sql`c.colors`, op, expectColors(value));
    case 'identity':
      return colorArraySql(sql`c.color_identity`, op, expectColors(value));
    case 'type':
      return textIlike(sql`c.type_line`, expectText(value));
    case 'oracle':
    case 'fulloracle':
      // fulloracle ≈ oracle until we store reminder text separately
      return oracleTextSql(expectText(value));
    case 'keyword':
      return keywordSql(expectText(value));
    case 'mana':
      return manaSymbolsSql(op, expectMana(value));
    case 'manavalue':
      return manaValueSql(op, expectMana(value));
    case 'devotion':
      return devotionSql(op, expectMana(value));
    case 'produces':
      return producesSql(op, expectMana(value));
    case 'rarity':
      return rarityAnyPrintingSql(op, expectRarity(value));
    case 'set':
      return setCodeSql(expectText(value).toLowerCase());
    case 'collectorNumber':
      return collectorNumberSql(op, value);
    case 'block':
      return blockSql(expectText(value).toLowerCase());
    case 'group':
      return groupSql(expectText(value).toLowerCase());
    case 'setType':
      return setTypeSql(expectText(value).toLowerCase());
    case 'in':
      return inSql(value);
    case 'format':
      return formatLegalSql(op, expectText(value).toLowerCase());
    case 'is':
      return isFlagSql(expectFlag(value));
    case 'has':
      return hasFlagSql(expectFlag(value));
    case 'new':
      return newFlagSql(expectFlag(value));
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
};

const colorArraySql = (column: SQL, op: CompareOp, value: ColorValue): SQL => {
  if (value.kind === 'colorless') {
    const empty = sql`coalesce(cardinality(${column}), 0) = 0`;
    if (op === '!=') return sql`(NOT (${empty}))`;
    return empty;
  }
  if (value.kind === 'multicolor') {
    const multi = sql`coalesce(cardinality(${column}), 0) > 1`;
    if (op === '!=') return sql`(NOT (${multi}))`;
    return multi;
  }
  if (value.kind === 'count') {
    const n = value.count;
    const card = sql`coalesce(cardinality(${column}), 0)`;
    return numericCompare(card, op, n);
  }

  const pips = value.pips;
  const arr = sql`ARRAY[${sql.join(
    pips.map((pip) => sql`${pip}`),
    sql`, `,
  )}]::text[]`;
  const card = sql`coalesce(${column}, ARRAY[]::text[])`;

  // : and >= → card contains all query pips (card ⊇ query)
  // = → exact
  // <= → card ⊆ query
  // < / > → proper subset / superset
  switch (op) {
    case ':':
    case '>=':
      return sql`${arr} <@ ${card}`;
    case '=':
      return sql`${card} @> ${arr} AND ${card} <@ ${arr}`;
    case '<=':
      return sql`${card} <@ ${arr}`;
    case '<':
      return sql`${card} <@ ${arr} AND ${card} <> ${arr}`;
    case '>':
      return sql`${arr} <@ ${card} AND ${card} <> ${arr}`;
    case '!=':
      return sql`NOT (${card} @> ${arr} AND ${card} <@ ${arr})`;
    default:
      return sql`${arr} <@ ${card}`;
  }
};

const oracleTextSql = (needle: string): SQL => {
  // `~` stands for the card name — compare after substituting name → ~ in oracle text.
  const pattern = `%${escapeIlike(needle)}%`;
  if (needle.includes('~')) {
    return sql`replace(c.oracle_text, c.name, '~') ILIKE ${pattern} ESCAPE '\\'`;
  }
  return sql`c.oracle_text ILIKE ${pattern} ESCAPE '\\'`;
};

const keywordSql = (kw: string): SQL => {
  const lower = kw.toLowerCase();
  return sql`EXISTS (
    SELECT 1 FROM unnest(coalesce(c.keywords, ARRAY[]::text[])) AS k(kw)
    WHERE lower(k.kw) = ${lower}
  )`;
};

const manaSymbolsSql = (op: CompareOp, value: ManaValue): SQL => {
  if (value.kind !== 'symbols') {
    throw new Error('mana: expects symbol list');
  }
  const checks = value.symbols.map((sym) => {
    const pattern = `%${escapeIlike(sym)}%`;
    return sql`coalesce(c.mana_cost, '') ILIKE ${pattern} ESCAPE '\\'`;
  });
  const containsAll = checks.length === 0 ? sql`TRUE` : sql`(${sql.join(checks, sql` AND `)})`;

  // Approximate comparisons: = / : → contains all; > → contains all and longer cost;
  // < / <= need multiset logic — treat as contains-all for :/= and NOT for !=
  if (op === '!=') return sql`(NOT (${containsAll}))`;
  if (op === '>' || op === '>=') {
    const joined = value.symbols.join('');
    return sql`(${containsAll}) AND length(coalesce(c.mana_cost, '')) > ${joined.length}`;
  }
  return containsAll;
};

const manaValueSql = (op: CompareOp, value: ManaValue): SQL => {
  if (value.kind === 'parity') {
    const even = sql`c.mana_value IS NOT NULL AND mod(c.mana_value::int, 2) = 0`;
    const odd = sql`c.mana_value IS NOT NULL AND mod(c.mana_value::int, 2) = 1`;
    const pred = value.parity === 'even' ? even : odd;
    if (op === '!=') return sql`(NOT (${pred}))`;
    return pred;
  }
  if (value.kind !== 'number') {
    throw new Error('manavalue: expects number or even/odd');
  }
  return sql`c.mana_value IS NOT NULL AND ${numericCompare(sql`c.mana_value`, op, value.n)}`;
};

const devotionSql = (_op: CompareOp, value: ManaValue): SQL => {
  // Count devotion pips: each symbol in the query must appear (order-insensitive containment).
  if (value.kind !== 'symbols') {
    throw new Error('devotion: expects mana symbols');
  }
  return manaSymbolsSql(':', value);
};

const producesSql = (op: CompareOp, value: ManaValue): SQL => {
  const pips = manaSymbolsToColorPips(value);
  if (pips.length === 0) {
    return sql`coalesce(cardinality(c.produced_mana), 0) = 0`;
  }
  return colorArraySql(sql`c.produced_mana`, op === ':' ? '>=' : op, { kind: 'pips', pips });
};

const manaSymbolsToColorPips = (value: ManaValue): ColorPip[] => {
  if (value.kind !== 'symbols') return [];
  const out: ColorPip[] = [];
  for (const sym of value.symbols) {
    const inner = sym.replace(/^\{|\}$/g, '').toUpperCase();
    if (inner === 'W' || inner === 'U' || inner === 'B' || inner === 'R' || inner === 'G') {
      if (!out.includes(inner)) out.push(inner);
    }
  }
  return out;
};

const rarityRankSql = (rarityCol: SQL): SQL => sql`(
  CASE lower(${rarityCol})
    WHEN 'common' THEN 0
    WHEN 'uncommon' THEN 1
    WHEN 'rare' THEN 2
    WHEN 'special' THEN 3
    WHEN 'mythic' THEN 4
    WHEN 'bonus' THEN 5
    ELSE -1
  END
)`;

const rarityAnyPrintingSql = (op: CompareOp, rarity: RarityName): SQL => {
  const rank = RARITY_RANK[rarity];
  if (op === ':' || op === '=') {
    return sql`EXISTS (
      SELECT 1 FROM catalog.printing p
      WHERE p.card_id = c.id AND lower(p.rarity) = ${rarity}
    )`;
  }
  if (op === '!=') {
    return sql`EXISTS (
      SELECT 1 FROM catalog.printing p
      WHERE p.card_id = c.id AND lower(p.rarity) IS DISTINCT FROM ${rarity}
    )`;
  }
  return sql`EXISTS (
    SELECT 1 FROM catalog.printing p
    WHERE p.card_id = c.id
      AND ${numericCompare(rarityRankSql(sql`p.rarity`), op, rank)}
  )`;
};

const setCodeSql = (code: string): SQL => sql`EXISTS (
  SELECT 1
  FROM catalog.printing p
  JOIN catalog.set s ON s.id = p.set_id
  WHERE p.card_id = c.id AND lower(s.code) = ${code}
)`;

const setTypeSql = (setType: string): SQL => sql`EXISTS (
  SELECT 1
  FROM catalog.printing p
  JOIN catalog.set s ON s.id = p.set_id
  WHERE p.card_id = c.id AND lower(s.set_type) = ${setType}
)`;

const blockSql = (codeOrBlock: string): SQL => sql`EXISTS (
  SELECT 1
  FROM catalog.printing p
  JOIN catalog.set s ON s.id = p.set_id
  WHERE p.card_id = c.id
    AND (
      lower(coalesce(s.block_code, '')) = ${codeOrBlock}
      OR lower(coalesce(s.block, '')) = ${codeOrBlock}
      OR lower(s.block_code) = (
        SELECT lower(s2.block_code)
        FROM catalog.set s2
        WHERE lower(s2.code) = ${codeOrBlock}
        LIMIT 1
      )
    )
)`;

const groupSql = (code: string): SQL => sql`EXISTS (
  SELECT 1
  FROM catalog.printing p
  JOIN catalog.set s ON s.id = p.set_id
  WHERE p.card_id = c.id
    AND lower(s.code) IN (
      SELECT lower(x.code)
      FROM catalog.set x
      WHERE lower(x.code) = ${code}
         OR lower(coalesce(x.parent_set_code, '')) = ${code}
         OR lower(x.code) = (
           SELECT lower(coalesce(p.parent_set_code, p.code))
           FROM catalog.set p WHERE lower(p.code) = ${code} LIMIT 1
         )
         OR lower(coalesce(x.parent_set_code, '')) = (
           SELECT lower(coalesce(p.parent_set_code, ''))
           FROM catalog.set p WHERE lower(p.code) = ${code} LIMIT 1
         )
    )
)`;

const collectorNumberSql = (op: CompareOp, value: ClauseValue): SQL => {
  if (value.kind === 'text') {
    const cn = value.text;
    return sql`EXISTS (
      SELECT 1 FROM catalog.printing p
      WHERE p.card_id = c.id AND p.collector_number = ${cn}
    )`;
  }
  if (value.kind !== 'number') {
    throw new Error('collectorNumber: expected number or text');
  }
  const n = value.n;
  // Compare numeric prefix of collector_number when possible
  const numExpr = sql`NULLIF(substring(p.collector_number from '^[0-9]+'), '')::int`;
  return sql`EXISTS (
    SELECT 1 FROM catalog.printing p
    WHERE p.card_id = c.id
      AND ${numExpr} IS NOT NULL
      AND ${numericCompare(numExpr, op, n)}
  )`;
};

const inSql = (value: ClauseValue): SQL => {
  if (value.kind === 'rarity') {
    return rarityAnyPrintingSql(':', value.rarity);
  }
  const text = expectText(value).toLowerCase();
  if (SET_TYPES.has(text)) return setTypeSql(text);
  return setCodeSql(text);
};

/** Same semantics as structured `legalIn`: `(legalities ->> format) = 'legal'`. */
const formatLegalSql = (op: CompareOp, format: string): SQL => {
  const legal = sql`(c.legalities ->> ${format}) = 'legal'`;
  if (op === '!=') return sql`(NOT (${legal}))`;
  return legal;
};

const isFlagSql = (flag: string): SQL => {
  switch (flag) {
    case 'hybrid':
      return sql`c.mana_cost ~ '\\{[^}/]+/[^}P]+\\}'`;
    case 'phyrexian':
      return sql`c.mana_cost ~* '\\{[^}]*P\\}'`;
    case 'booster':
      return sql`EXISTS (
        SELECT 1 FROM catalog.printing p
        WHERE p.card_id = c.id AND p.booster IS TRUE
      )`;
    default:
      // Promo types and similar — match promo_types array
      return sql`EXISTS (
        SELECT 1 FROM catalog.printing p
        WHERE p.card_id = c.id
          AND ${flag} = ANY (coalesce(p.promo_types, ARRAY[]::text[]))
      )`;
  }
};

const hasFlagSql = (flag: string): SQL => {
  if (flag === 'indicator') {
    return sql`c.has_color_indicator IS TRUE`;
  }
  return sql`FALSE`;
};

const newFlagSql = (flag: string): SQL => {
  if (flag !== 'rarity') return sql`FALSE`;
  // A printing whose rarity did not appear on any earlier printing of the same card
  return sql`EXISTS (
    SELECT 1
    FROM catalog.printing p
    WHERE p.card_id = c.id
      AND p.rarity IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM catalog.printing earlier
        WHERE earlier.card_id = c.id
          AND earlier.id <> p.id
          AND earlier.rarity = p.rarity
          AND (
            earlier.released_at < p.released_at
            OR (earlier.released_at IS NOT DISTINCT FROM p.released_at AND earlier.scryfall_id < p.scryfall_id)
          )
      )
  )`;
};

const textIlike = (column: SQL, text: string): SQL => {
  const pattern = `%${escapeIlike(text)}%`;
  return sql`${column} ILIKE ${pattern} ESCAPE '\\'`;
};

const numericCompare = (expr: SQL, op: CompareOp, n: number): SQL => {
  switch (op) {
    case ':':
    case '=':
      return sql`${expr} = ${n}`;
    case '!=':
      return sql`${expr} <> ${n}`;
    case '<':
      return sql`${expr} < ${n}`;
    case '>':
      return sql`${expr} > ${n}`;
    case '<=':
      return sql`${expr} <= ${n}`;
    case '>=':
      return sql`${expr} >= ${n}`;
    default:
      return sql`${expr} = ${n}`;
  }
};

const expectColors = (value: ClauseValue): ColorValue => {
  if (value.kind !== 'colors') throw new Error('expected colors value');
  return value.value;
};

const expectText = (value: ClauseValue): string => {
  if (value.kind !== 'text') throw new Error('expected text value');
  return value.text;
};

const expectMana = (value: ClauseValue): ManaValue => {
  if (value.kind !== 'mana') throw new Error('expected mana value');
  return value.value;
};

const expectRarity = (value: ClauseValue): RarityName => {
  if (value.kind !== 'rarity') throw new Error('expected rarity value');
  return value.rarity;
};

const expectFlag = (value: ClauseValue): string => {
  if (value.kind !== 'flag') throw new Error('expected flag value');
  return value.flag;
};

const escapeIlike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
