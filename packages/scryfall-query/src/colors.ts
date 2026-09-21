import type { ColorPip, ColorValue } from './ast.js';
import { ScryfallQueryError } from './error.js';

const COLOR_NAMES: Record<string, ColorPip> = {
  white: 'W',
  w: 'W',
  blue: 'U',
  u: 'U',
  black: 'B',
  b: 'B',
  red: 'R',
  r: 'R',
  green: 'G',
  g: 'G',
};

/** Guild / shard / college / wedge / 4c nicknames → WUBRG pips (ordered WUBRG). */
const COLOR_NICKNAMES: Record<string, ColorPip[]> = {
  // Guilds
  azorius: ['W', 'U'],
  dimir: ['U', 'B'],
  rakdos: ['B', 'R'],
  gruul: ['R', 'G'],
  selesnya: ['G', 'W'],
  orzhov: ['W', 'B'],
  izzet: ['U', 'R'],
  golgari: ['B', 'G'],
  boros: ['R', 'W'],
  simic: ['G', 'U'],
  // Shards
  bant: ['G', 'W', 'U'],
  esper: ['W', 'U', 'B'],
  grixis: ['U', 'B', 'R'],
  jund: ['B', 'R', 'G'],
  naya: ['R', 'G', 'W'],
  // Wedges
  abzan: ['W', 'B', 'G'],
  jeskai: ['U', 'R', 'W'],
  sultai: ['B', 'G', 'U'],
  mardu: ['R', 'W', 'B'],
  temur: ['G', 'U', 'R'],
  // Colleges (Strixhaven)
  silverquill: ['W', 'B'],
  prismari: ['U', 'R'],
  witherbloom: ['B', 'G'],
  lorehold: ['R', 'W'],
  quandrix: ['G', 'U'],
  // Four-color
  chaos: ['U', 'B', 'R', 'G'],
  aggression: ['W', 'B', 'R', 'G'],
  altruism: ['W', 'U', 'R', 'G'],
  growth: ['W', 'U', 'B', 'G'],
  artifice: ['W', 'U', 'B', 'R'],
};

const PIP_ORDER: ColorPip[] = ['W', 'U', 'B', 'R', 'G'];

const sortPips = (pips: ColorPip[]): ColorPip[] => PIP_ORDER.filter((pip) => pips.includes(pip));

/**
 * Parse a Scryfall color / identity value into a structured ColorValue.
 * Accepts letters (`rg`), names (`red`), nicknames (`esper`), `c`/`colorless`,
 * `m`/`multicolor`, or a digit count (`2`).
 */
export const parseColorValue = (raw: string): ColorValue => {
  const text = raw.trim().toLowerCase();
  if (!text) {
    throw new ScryfallQueryError('Empty color value');
  }

  if (text === 'c' || text === 'colorless') return { kind: 'colorless' };
  if (text === 'm' || text === 'multicolor') return { kind: 'multicolor' };

  if (/^\d+$/.test(text)) {
    return { kind: 'count', count: Number(text) };
  }

  const nickname = COLOR_NICKNAMES[text];
  if (nickname) return { kind: 'pips', pips: sortPips(nickname) };

  // Single color name
  const named = COLOR_NAMES[text];
  if (named) return { kind: 'pips', pips: [named] };

  // Letter string like `rg`, `wubrg`, possibly mixed with names not applicable
  const pips: ColorPip[] = [];
  for (const ch of text) {
    const pip = COLOR_NAMES[ch];
    if (!pip) {
      throw new ScryfallQueryError(`Unknown color “${raw}”`, 'unsupported');
    }
    if (!pips.includes(pip)) pips.push(pip);
  }
  return { kind: 'pips', pips: sortPips(pips) };
};

export const COLOR_NICKNAME_KEYS = Object.keys(COLOR_NICKNAMES).sort();
