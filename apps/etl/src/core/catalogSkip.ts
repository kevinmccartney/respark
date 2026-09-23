/** Scryfall layouts that are never a deck card. */
export const SKIP_LAYOUTS = new Set([
  'art_series',
  'token',
  'double_faced_token',
  'emblem',
  'front_card',
  'planar',
  'scheme',
  'vanguard',
]);

/** Scryfall set types that are extras (tokens, art/trophy, minigames). */
export const SKIP_SET_TYPES = new Set(['token', 'memorabilia', 'minigame']);

/** Digital-only set types (Alchemy); usually also `digital: true` on Scryfall. */
export const SKIP_DIGITAL_SET_TYPES = new Set(['alchemy']);

export type CatalogSkipInput = {
  layout?: string | null;
  typeLine?: string | null;
  setType?: string | null;
  /** Scryfall set/card `digital` — video-game-only release. */
  digital?: boolean | null;
  /** Scryfall card name — Alchemy rebalances use an `A-` prefix. */
  name?: string | null;
};

/** True when any `//`-separated face is a bare "Card". */
export const hasBareCardFace = (typeLine: string | null | undefined): boolean => {
  if (!typeLine) return false;
  return typeLine.split('//').some((face) => face.trim() === 'Card');
};

/** Alchemy rebalance names (e.g. `A-Acererak the Archlich`). */
export const hasAlchemyNamePrefix = (name: string | null | undefined): boolean => {
  if (!name) return false;
  return name.trimStart().startsWith('A-');
};

/**
 * True for digital-only catalog objects: Scryfall `digital`, alchemy set type,
 * or Alchemy rebalance name prefix (`A-…`).
 */
export const isDigitalCatalogSkip = (
  card: Pick<CatalogSkipInput, 'digital' | 'setType' | 'name'>,
): boolean => {
  if (card.digital === true) return true;
  if (hasAlchemyNamePrefix(card.name)) return true;
  const setType = card.setType?.trim();
  return Boolean(setType && SKIP_DIGITAL_SET_TYPES.has(setType));
};

/**
 * True for objects that must not enter catalog/raw: art series, tokens,
 * emblems, minigames, planes, schemes, vanguards, digital-only cards/sets, and
 * a bare `Card` type line.
 * Do not key off legalities — extras are a full `not_legal` map, same as Un-sets.
 */
export const isCatalogExtra = (card: CatalogSkipInput): boolean => {
  if (isDigitalCatalogSkip(card)) return true;
  const layout = card.layout?.trim();
  if (layout && SKIP_LAYOUTS.has(layout)) return true;
  const setType = card.setType?.trim();
  if (setType && SKIP_SET_TYPES.has(setType)) return true;
  return hasBareCardFace(card.typeLine);
};
