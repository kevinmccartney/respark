import { sql } from 'drizzle-orm';
import type { Database } from '../db/database.module';
import { normalizeCardName, type MoxfieldLine } from '../decks/moxfield-import';

export const bestPrintingOrderSql = sql`
  (p.image_normal IS NOT NULL OR f.image_normal IS NOT NULL) DESC,
  p.released_at DESC NULLS LAST,
  p.id
`;

export const defaultPrintingId = async (db: Database, cardId: string): Promise<string | null> => {
  const ids = await defaultPrintingIds(db, [cardId]);
  return ids.get(cardId) ?? null;
};

export const defaultPrintingIds = async (
  db: Database,
  cardIds: string[],
): Promise<Map<string, string>> => {
  const unique = [...new Set(cardIds)];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const rows = await db.execute<{ card_id: string; id: string }>(sql`
    SELECT DISTINCT ON (p.card_id)
      p.card_id,
      p.id
    FROM catalog.printing p
    LEFT JOIN catalog.card_face f
      ON f.printing_id = p.id AND f.face_index = 0
    WHERE p.card_id IN (${sql.join(
      unique.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    ORDER BY p.card_id, ${bestPrintingOrderSql}
  `);

  for (const row of rows.rows) {
    result.set(row.card_id, row.id);
  }
  return result;
};

type PrintingCandidate = {
  id: string;
  name: string;
  language: string | null;
  set_code: string;
  collector_number: string;
};

export const resolveMoxfieldPrintings = async (
  db: Database,
  lines: MoxfieldLine[],
): Promise<(string | null)[]> => {
  const resolved = lines.map(() => null as string | null);
  if (lines.length === 0) return resolved;

  const bySetNumber = await loadPrintingsBySetAndNumber(db, lines);
  const unmatchedIndexes: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = setNumberKey(line.setCode, line.collectorNumber);
    const candidates = bySetNumber.get(key);
    if (!candidates || candidates.length === 0) {
      unmatchedIndexes.push(i);
      continue;
    }
    const wantedName = normalizeCardName(line.name);
    const nameMatch = candidates.find((row) => normalizeCardName(row.name) === wantedName);
    resolved[i] = (nameMatch ?? candidates[0]).id;
  }

  if (unmatchedIndexes.length === 0) return resolved;

  const fallbackLines = unmatchedIndexes.map((i) => lines[i]);
  const cardIdsByName = await loadCardIdsByName(
    db,
    fallbackLines.map((line) => normalizeCardName(line.name)),
  );

  const cardIds: string[] = [];
  const indexCardId = new Map<number, string>();
  for (const i of unmatchedIndexes) {
    const cardId = cardIdsByName.get(normalizeCardName(lines[i].name));
    if (!cardId) continue;
    indexCardId.set(i, cardId);
    cardIds.push(cardId);
  }

  const inSet = await loadPrintingsForCardsInSets(
    db,
    cardIds,
    fallbackLines.map((line) => line.setCode),
  );
  const stillMissing: number[] = [];

  for (const i of unmatchedIndexes) {
    const cardId = indexCardId.get(i);
    if (!cardId) continue;
    const line = lines[i];
    const cardPrintings = inSet.get(cardId) ?? [];
    const inRequestedSet = cardPrintings.filter(
      (row) => row.set_code === line.setCode.toLowerCase(),
    );
    if (inRequestedSet.length > 0) {
      const collectorMatch = inRequestedSet.find(
        (row) => row.collector_number === line.collectorNumber.toLowerCase(),
      );
      resolved[i] = (collectorMatch ?? inRequestedSet[0]).id;
    } else {
      stillMissing.push(i);
    }
  }

  const defaultIds = await defaultPrintingIds(
    db,
    stillMissing.map((i) => indexCardId.get(i)!).filter(Boolean),
  );
  for (const i of stillMissing) {
    const cardId = indexCardId.get(i);
    if (!cardId) continue;
    resolved[i] = defaultIds.get(cardId) ?? null;
  }

  return resolved;
};

const setNumberKey = (setCode: string, collectorNumber: string): string =>
  `${setCode.toLowerCase()}::${collectorNumber.toLowerCase()}`;

const loadPrintingsBySetAndNumber = async (
  db: Database,
  lines: MoxfieldLine[],
): Promise<Map<string, PrintingCandidate[]>> => {
  const pairs = [
    ...new Map(
      lines.map((line) => [setNumberKey(line.setCode, line.collectorNumber), line] as const),
    ).values(),
  ];

  const result = new Map<string, PrintingCandidate[]>();
  if (pairs.length === 0) return result;

  const rows = await db.execute<PrintingCandidate>(sql`
    SELECT
      p.id,
      c.name,
      p.language,
      lower(s.code) AS set_code,
      lower(p.collector_number) AS collector_number
    FROM catalog.printing p
    JOIN catalog.set s ON s.id = p.set_id
    JOIN catalog.card c ON c.id = p.card_id
    WHERE (lower(s.code), lower(p.collector_number)) IN (${sql.join(
      pairs.map((line) => sql`(lower(${line.setCode}), lower(${line.collectorNumber}))`),
      sql`, `,
    )})
    ORDER BY
      CASE WHEN p.language = 'en' THEN 0 ELSE 1 END,
      p.id
  `);

  for (const row of rows.rows) {
    const key = setNumberKey(row.set_code, row.collector_number);
    const list = result.get(key) ?? [];
    list.push(row);
    result.set(key, list);
  }
  return result;
};

const loadCardIdsByName = async (db: Database, names: string[]): Promise<Map<string, string>> => {
  const unique = [...new Set(names)];
  const result = new Map<string, string>();
  if (unique.length === 0) return result;

  const rows = await db.execute<{ id: string; name: string }>(sql`
    SELECT c.id, lower(c.name) AS name
    FROM catalog.card c
    WHERE lower(c.name) IN (${sql.join(
      unique.map((name) => sql`${name}`),
      sql`, `,
    )})
  `);

  for (const row of rows.rows) {
    if (!result.has(row.name)) result.set(row.name, row.id);
  }
  return result;
};

const loadPrintingsForCardsInSets = async (
  db: Database,
  cardIds: string[],
  setCodes: string[],
): Promise<Map<string, PrintingCandidate[]>> => {
  const uniqueCards = [...new Set(cardIds)];
  const uniqueSets = [...new Set(setCodes.map((code) => code.toLowerCase()))];
  const result = new Map<string, PrintingCandidate[]>();
  if (uniqueCards.length === 0 || uniqueSets.length === 0) return result;

  const rows = await db.execute<PrintingCandidate & { card_id: string }>(sql`
    SELECT
      p.id,
      p.card_id,
      c.name,
      p.language,
      lower(s.code) AS set_code,
      lower(p.collector_number) AS collector_number
    FROM catalog.printing p
    JOIN catalog.set s ON s.id = p.set_id
    JOIN catalog.card c ON c.id = p.card_id
    WHERE p.card_id IN (${sql.join(
      uniqueCards.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
      AND lower(s.code) IN (${sql.join(
        uniqueSets.map((code) => sql`${code}`),
        sql`, `,
      )})
    ORDER BY
      CASE WHEN p.language = 'en' THEN 0 ELSE 1 END,
      p.released_at DESC NULLS LAST,
      p.id
  `);

  for (const row of rows.rows) {
    const list = result.get(row.card_id) ?? [];
    list.push(row);
    result.set(row.card_id, list);
  }
  return result;
};
