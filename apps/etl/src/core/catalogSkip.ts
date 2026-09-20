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

export type CatalogSkipInput = {
  layout?: string | null;
  typeLine?: string | null;
  setType?: string | null;
};

/** True when any `//`-separated face is a bare "Card". */
export const hasBareCardFace = (typeLine: string | null | undefined): boolean => {
  if (!typeLine) return false;
  return typeLine.split('//').some((face) => face.trim() === 'Card');
};

/**
 * True for objects that must not enter catalog/raw: art series, tokens,
 * emblems, minigames, planes, schemes, vanguards, and a bare `Card` type line.
 * Do not key off legalities — extras are a full `not_legal` map, same as Un-sets.
 */
export const isCatalogExtra = (card: CatalogSkipInput): boolean => {
  const layout = card.layout?.trim();
  if (layout && SKIP_LAYOUTS.has(layout)) return true;
  const setType = card.setType?.trim();
  if (setType && SKIP_SET_TYPES.has(setType)) return true;
  return hasBareCardFace(card.typeLine);
};
