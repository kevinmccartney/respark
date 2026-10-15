import type { DeckCardChange, DeckDetailChange } from '@respark/schemas/deck-revisions';
import { deckFormatSchema } from '@respark/schemas/decks';

import { DECK_FORMAT_LABELS } from '../constants';

const DETAIL_LABELS: Record<DeckDetailChange['field'], string> = {
  name: 'Name',
  description: 'Description',
  format: 'Format',
  commander: 'Commander',
};

const detailValue = (field: DeckDetailChange['field'], value: string | null): string => {
  if (value === null || value === '') return 'none';
  if (field !== 'format') return value;
  const format = deckFormatSchema.safeParse(value);
  return format.success ? DECK_FORMAT_LABELS[format.data] : value;
};

/** `Name: Ramp → Big Ramp` */
export const describeDetailChange = (change: DeckDetailChange): string =>
  `${DETAIL_LABELS[change.field]}: ${detailValue(change.field, change.from)} → ${detailValue(change.field, change.to)}`;

/** `M21 #263 foil` */
export const describeStackPrinting = (change: DeckCardChange): string =>
  `${change.setCode.toUpperCase()} #${change.collectorNumber}${change.foil ? ' foil' : ''}`;

/** Text around the card name: `4× ` before for adds/removes, `: 3 → 2` after for updates. */
export const cardChangeQuantityParts = (
  change: DeckCardChange,
): { before: string; after: string } => {
  if (change.kind === 'added') return { before: `${change.quantity.to}× `, after: '' };
  if (change.kind === 'removed') return { before: `${change.quantity.from}× `, after: '' };
  return { before: '', after: `: ${change.quantity.from} → ${change.quantity.to}` };
};

export const CARD_CHANGE_HEADINGS: Record<DeckCardChange['kind'], string> = {
  added: 'Added',
  removed: 'Removed',
  updated: 'Updated',
};
