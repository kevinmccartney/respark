import type { Field } from './ast.js';
import { ScryfallQueryError } from './error.js';

/** Supported field aliases for the six Scryfall sections in scope. */
export const FIELD_ALIASES: Record<string, Field> = {
  c: 'color',
  color: 'color',
  id: 'identity',
  identity: 'identity',
  t: 'type',
  type: 'type',
  o: 'oracle',
  oracle: 'oracle',
  fo: 'fulloracle',
  fulloracle: 'fulloracle',
  kw: 'keyword',
  keyword: 'keyword',
  m: 'mana',
  mana: 'mana',
  mv: 'manavalue',
  manavalue: 'manavalue',
  devotion: 'devotion',
  produces: 'produces',
  r: 'rarity',
  rarity: 'rarity',
  s: 'set',
  e: 'set',
  set: 'set',
  edition: 'set',
  cn: 'collectorNumber',
  number: 'collectorNumber',
  b: 'block',
  block: 'block',
  g: 'group',
  group: 'group',
  st: 'setType',
  in: 'in',
  is: 'is',
  has: 'has',
  new: 'new',
};

/**
 * Known Scryfall keywords that are intentionally out of scope for this pass.
 * Using them returns a clear unsupported error rather than treating them as names.
 */
export const UNSUPPORTED_FIELD_ALIASES: Record<string, string> = {
  f: 'format',
  format: 'format',
  banned: 'banned',
  restricted: 'restricted',
  pow: 'power',
  power: 'power',
  tou: 'toughness',
  toughness: 'toughness',
  pt: 'powtou',
  powtou: 'powtou',
  loy: 'loyalty',
  loyalty: 'loyalty',
  usd: 'usd',
  eur: 'eur',
  tix: 'tix',
  a: 'artist',
  artist: 'artist',
  ft: 'flavor',
  flavor: 'flavor',
  wm: 'watermark',
  watermark: 'watermark',
  cube: 'cube',
  year: 'year',
  cheapest: 'cheapest',
  include: 'include',
  game: 'game',
  border: 'border',
  frame: 'frame',
  artists: 'artists',
  illustrations: 'illustrations',
  edhrec: 'edhrecrank',
  edhrecrank: 'edhrecrank',
};

/** `is:` values supported in the colors/mana/sets sections. */
export const SUPPORTED_IS_FLAGS = new Set([
  'hybrid',
  'phyrexian',
  'booster',
  'planeswalker_deck',
  'league',
  'buyabox',
  'giftbox',
  'intro_pack',
  'gameday',
  'prerelease',
  'release',
  'fnm',
  'judge_gift',
  'arena_league',
  'player_rewards',
  'media_insert',
  'instore',
  'convention',
  'set_promo',
  'datestamped',
]);

export const SUPPORTED_HAS_FLAGS = new Set(['indicator']);

export const SUPPORTED_NEW_FLAGS = new Set(['rarity']);

export const resolveField = (raw: string): Field => {
  const key = raw.toLowerCase();
  const field = FIELD_ALIASES[key];
  if (field) return field;

  const unsupported = UNSUPPORTED_FIELD_ALIASES[key];
  if (unsupported) {
    throw new ScryfallQueryError(
      `Unsupported Scryfall keyword “${raw}” (not in local colors/types/oracle/mana/rarity/sets support yet)`,
      'unsupported',
    );
  }

  throw new ScryfallQueryError(`Unknown Scryfall keyword “${raw}”`, 'unsupported');
};
