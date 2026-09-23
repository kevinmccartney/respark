import type { ColorIdentityPip, DeckCard, DeckFormat } from '@respark/schemas/decks';

export type {
  ColorIdentityPip,
  CreateDeckInput,
  Deck,
  DeckCard,
  DeckDetail,
  DeckFormat,
  DeckImportResult,
  DeckImportUnmatched,
  UpdateDeckInput,
} from '@respark/schemas/decks';

export type { DeckGroupMode, DeckSortMode, DeckViewMode } from './constants';

export type DeckCardGroup = {
  key: string;
  label: string;
  cards: DeckCard[];
  totalQuantity: number;
  colorIdentity?: ColorIdentityPip[];
};

export type SaveDeckDetailsInput = {
  name: string;
  format: DeckFormat;
  description: string | null;
  commanderPrintingId: string | null;
};
