/**
 * Moxfield-style deck export lines, e.g.:
 *   1 Arcane Signet (LCC) 299
 *   1 Boseiju, Who Endures (NEO) 266 *F*
 *   SIDEBOARD:
 *   1 Aether Vial (MB2) 216
 *   SB: 1 Relic of Progenitus (EMA) 232
 */
export type MoxfieldLine = {
  raw: string;
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  tags: string[];
  sideboard: boolean;
};

/** qty  name  (SET)  collector  [*tags…] */
const MOXFIELD_LINE_RE =
  /^(\d+)\s+(.+?)\s+\(([A-Za-z0-9]+)\)\s+(\S+)(?:\s+((?:\*[^*\s]+\*\s*)+))?\s*$/;

type BoardSection = 'main' | 'sideboard' | 'skip';

export const parseMoxfieldExport = (
  text: string,
): {
  lines: MoxfieldLine[];
  skipped: { raw: string; reason: string }[];
} => {
  const lines: MoxfieldLine[] = [];
  const skipped: { raw: string; reason: string }[] = [];
  let section: BoardSection = 'main';

  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw) continue;

    const header = parseSectionHeader(raw);
    if (header) {
      section = header;
      continue;
    }

    let lineText = raw;
    let sideboard = section === 'sideboard';

    if (/^sb:\s*/i.test(lineText)) {
      lineText = lineText.replace(/^sb:\s*/i, '').trim();
      sideboard = true;
    }

    if (section === 'skip') {
      skipped.push({ raw, reason: 'maybeboard line ignored' });
      continue;
    }

    const match = MOXFIELD_LINE_RE.exec(lineText);
    if (!match) {
      skipped.push({ raw, reason: 'unrecognized line format' });
      continue;
    }

    const quantity = Number.parseInt(match[1], 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      skipped.push({ raw, reason: 'invalid quantity' });
      continue;
    }

    const tags = match[5]?.match(/\*[^*\s]+\*/g)?.map((tag) => tag.slice(1, -1)) ?? [];

    lines.push({
      raw,
      quantity,
      name: match[2].trim(),
      setCode: match[3],
      collectorNumber: match[4],
      tags,
      sideboard,
    });
  }

  return { lines, skipped };
};

const parseSectionHeader = (raw: string): BoardSection | null => {
  if (/^sideboard\s*:?\s*$/i.test(raw)) return 'sideboard';
  if (/^(deck|mainboard|commander)\s*:?\s*$/i.test(raw)) return 'main';
  if (/^maybeboard\s*:?\s*$/i.test(raw)) return 'skip';
  return null;
};

/** Normalize DFC slash variants and casing for comparison. */
export const normalizeCardName = (name: string): string =>
  name
    .replace(/\s*\/\/\s*/g, ' // ')
    .replace(/\s+\/\s+/g, ' // ')
    .trim()
    .toLowerCase();
