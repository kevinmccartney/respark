import type { ColorIdentityPip, DeckCard } from '@respark/schemas/decks';

import {
  DECK_COLOR_GROUP_LABELS,
  DECK_COLOR_GROUP_ORDER,
  DECK_TYPE_PRIORITY,
  type DeckGroupMode,
  type DeckSortMode,
} from '../constants';
import type { DeckCardGroup } from '../types';

const TYPE_SORT_INDEX = new Map(DECK_TYPE_PRIORITY.map((type, index) => [type, index]));
const COLOR_GROUP_INDEX = new Map(DECK_COLOR_GROUP_ORDER.map((key, index) => [key, index]));

export const primaryCardType = (typeLine: string | null | undefined): string => {
  if (!typeLine?.trim()) return 'Other';
  const front = typeLine.split('—')[0] ?? typeLine;
  for (const type of DECK_TYPE_PRIORITY) {
    if (new RegExp(`\\b${type}\\b`, 'i').test(front)) {
      return type;
    }
  }
  return 'Other';
};

const typeGroupKey = (card: DeckCard): string => primaryCardType(card.typeLine);

const typeGroupLabel = (key: string): string => {
  if (key === 'Other') return 'Other';
  if (key === 'Sorcery') return 'Sorceries';
  if (key.endsWith('y')) return `${key.slice(0, -1)}ies`;
  if (key.endsWith('s')) return key;
  return `${key}s`;
};

const colorGroupKey = (card: DeckCard): string => {
  if (card.colorIdentity.length === 0) return 'colorless';
  if (card.colorIdentity.length > 1) return 'multicolor';
  return card.colorIdentity[0] ?? 'colorless';
};

const colorGroupLabel = (key: string): string => {
  if (key in DECK_COLOR_GROUP_LABELS) {
    return DECK_COLOR_GROUP_LABELS[key as (typeof DECK_COLOR_GROUP_ORDER)[number]];
  }
  return key;
};

const colorGroupPips = (key: string): ColorIdentityPip[] | undefined => {
  if (key === 'W' || key === 'U' || key === 'B' || key === 'R' || key === 'G') {
    return [key];
  }
  return undefined;
};

const cmcGroupKey = (card: DeckCard): string => {
  const value = manaValueNumber(card);
  if (value === Number.POSITIVE_INFINITY) return 'unknown';
  return String(Math.floor(value));
};

const cmcGroupLabel = (key: string): string => {
  if (key === 'unknown') return 'CMC —';
  return `CMC ${key}`;
};

const bucketBy = (
  cards: DeckCard[],
  keyOf: (card: DeckCard) => string,
): Map<string, DeckCard[]> => {
  const buckets = new Map<string, DeckCard[]>();
  for (const card of cards) {
    const key = keyOf(card);
    const list = buckets.get(key);
    if (list) list.push(card);
    else buckets.set(key, [card]);
  }
  return buckets;
};

const compareByName = (a: DeckCard, b: DeckCard): number => {
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName;
  return a.setCode.localeCompare(b.setCode);
};

const compareByCmc = (a: DeckCard, b: DeckCard): number => {
  const byCmc = manaValueNumber(a) - manaValueNumber(b);
  if (byCmc !== 0) return byCmc;
  return compareByName(a, b);
};

const compareByColor = (a: DeckCard, b: DeckCard): number => {
  const aKey = a.colorIdentity.join('');
  const bKey = b.colorIdentity.join('');
  if (!aKey && bKey) return 1;
  if (aKey && !bKey) return -1;
  const byColor = aKey.localeCompare(bKey);
  if (byColor !== 0) return byColor;
  return compareByName(a, b);
};

const compareTypeKeys = (a: string, b: string): number => {
  const ai = TYPE_SORT_INDEX.get(a as (typeof DECK_TYPE_PRIORITY)[number]) ?? 99;
  const bi = TYPE_SORT_INDEX.get(b as (typeof DECK_TYPE_PRIORITY)[number]) ?? 99;
  if (ai !== bi) return ai - bi;
  return a.localeCompare(b);
};

const compareColorGroupKeys = (a: string, b: string): number => {
  const ai = COLOR_GROUP_INDEX.get(a as (typeof DECK_COLOR_GROUP_ORDER)[number]) ?? 99;
  const bi = COLOR_GROUP_INDEX.get(b as (typeof DECK_COLOR_GROUP_ORDER)[number]) ?? 99;
  if (ai !== bi) return ai - bi;
  return a.localeCompare(b);
};

const compareCmcKeys = (a: string, b: string): number => {
  if (a === 'unknown') return 1;
  if (b === 'unknown') return -1;
  return Number(a) - Number(b);
};

const manaValueNumber = (card: DeckCard): number => {
  if (card.manaValue == null || card.manaValue === '') return Number.POSITIVE_INFINITY;
  const value = Number(card.manaValue);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const sumQuantity = (cards: DeckCard[]): number =>
  cards.reduce((sum, card) => sum + card.quantity, 0);

type GroupStrategy = {
  keyOf: (card: DeckCard) => string;
  compareKeys: (a: string, b: string) => number;
  labelOf: (key: string) => string;
  colorIdentityOf?: (key: string) => ColorIdentityPip[] | undefined;
};

const GROUP_STRATEGIES: Record<DeckGroupMode, GroupStrategy> = {
  type: {
    keyOf: typeGroupKey,
    compareKeys: compareTypeKeys,
    labelOf: typeGroupLabel,
  },
  color: {
    keyOf: colorGroupKey,
    compareKeys: compareColorGroupKeys,
    labelOf: colorGroupLabel,
    colorIdentityOf: colorGroupPips,
  },
  cmc: {
    keyOf: cmcGroupKey,
    compareKeys: compareCmcKeys,
    labelOf: cmcGroupLabel,
  },
};

const SORT_COMPARATORS: Record<DeckSortMode, (a: DeckCard, b: DeckCard) => number> = {
  name: compareByName,
  cmc: compareByCmc,
  color: compareByColor,
};

export const groupDeckCards = (
  cards: DeckCard[],
  groupMode: DeckGroupMode,
  sortMode: DeckSortMode,
): DeckCardGroup[] => {
  const group = GROUP_STRATEGIES[groupMode];
  const compareCards = SORT_COMPARATORS[sortMode];
  const buckets = bucketBy(cards, group.keyOf);
  const keys = [...buckets.keys()].sort(group.compareKeys);

  return keys.map((key) => {
    const groupCards = [...(buckets.get(key) ?? [])].sort(compareCards);
    return {
      key,
      label: group.labelOf(key),
      cards: groupCards,
      totalQuantity: sumQuantity(groupCards),
      colorIdentity: group.colorIdentityOf?.(key),
    };
  });
};

export const commanderDeckGroup = (
  cards: DeckCard[],
  sortMode: DeckSortMode,
): DeckCardGroup | null => {
  if (cards.length === 0) return null;
  const sorted = [...cards].sort(SORT_COMPARATORS[sortMode]);
  return {
    key: 'commander',
    label: 'Commander',
    cards: sorted,
    totalQuantity: sumQuantity(sorted),
  };
};
