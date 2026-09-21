import type { RarityName } from './ast.js';
import { ScryfallQueryError } from './error.js';

/** Numeric ranks for rarity comparisons (`r>=rare` → rare + mythic). */
export const RARITY_RANK: Record<RarityName, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  special: 3,
  mythic: 4,
  bonus: 5,
};

const RARITY_ALIASES: Record<string, RarityName> = {
  common: 'common',
  c: 'common',
  uncommon: 'uncommon',
  u: 'uncommon',
  rare: 'rare',
  r: 'rare',
  mythic: 'mythic',
  m: 'mythic',
  special: 'special',
  s: 'special',
  bonus: 'bonus',
  b: 'bonus',
};

export const parseRarityName = (raw: string): RarityName => {
  const key = raw.trim().toLowerCase();
  const rarity = RARITY_ALIASES[key];
  if (!rarity) {
    throw new ScryfallQueryError(`Unknown rarity “${raw}”`);
  }
  return rarity;
};

export const isRarityName = (raw: string): boolean =>
  RARITY_ALIASES[raw.trim().toLowerCase()] !== undefined;
