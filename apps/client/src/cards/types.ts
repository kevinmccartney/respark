import type { CardSearchSort } from '@respark/schemas/cards';
import type { ColorIdentityPip, DeckFormat } from '@respark/schemas/decks';

export type CardSearchOpts = {
  scryfall?: string;
  legalIn?: DeckFormat;
  colorIdentity?: ColorIdentityPip[];
  commanderEligible?: boolean;
  sort?: CardSearchSort;
  limit?: number;
  page?: number;
};

export type CardSuggestionOpts = {
  limit?: number;
  legalIn?: DeckFormat;
  colorIdentity?: ColorIdentityPip[];
  commanderEligible?: boolean;
};

export type PageSize = 24 | 60 | 100;
