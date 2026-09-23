import type { DeckFormat } from '@respark/schemas/decks';

export const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
};

export const DECK_GROUP_MODES = ['type', 'color', 'cmc'] as const;
export type DeckGroupMode = (typeof DECK_GROUP_MODES)[number];
export const DECK_GROUP_LABELS: Record<DeckGroupMode, string> = {
  type: 'Type',
  color: 'Color identity',
  cmc: 'CMC',
};

export const DECK_SORT_MODES = ['name', 'cmc', 'color'] as const;
export type DeckSortMode = (typeof DECK_SORT_MODES)[number];
export const DECK_SORT_LABELS: Record<DeckSortMode, string> = {
  name: 'Name',
  cmc: 'CMC',
  color: 'Color',
};

export const DECK_VIEW_MODES = ['list', 'visual'] as const;
export type DeckViewMode = (typeof DECK_VIEW_MODES)[number];
export const DECK_VIEW_LABELS: Record<DeckViewMode, string> = {
  list: 'List',
  visual: 'Visual',
};

export const DECK_TYPE_PRIORITY = [
  'Planeswalker',
  'Creature',
  'Battle',
  'Instant',
  'Sorcery',
  'Enchantment',
  'Artifact',
  'Land',
] as const;

export const DECK_COLOR_GROUP_ORDER = ['W', 'U', 'B', 'R', 'G', 'multicolor', 'colorless'] as const;

export const DECK_COLOR_GROUP_LABELS: Record<(typeof DECK_COLOR_GROUP_ORDER)[number], string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  multicolor: 'Multicolor',
  colorless: 'Colorless',
};
