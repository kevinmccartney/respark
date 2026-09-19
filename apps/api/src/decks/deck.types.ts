import type { DeckFormat } from '../db/schema/decks';

export type { DeckFormat };

export type Deck = {
  id: string;
  name: string;
  description: string | null;
  format: DeckFormat;
  updatedAt: string;
};

export type DeckCard = {
  id: string;
  cardId: string;
  printingId: string;
  name: string;
  manaCost: string | null;
  manaValue: string | null;
  typeLine: string | null;
  foil: boolean;
  sideboard: boolean;
  quantity: number;
  setCode: string;
  setName: string;
  collectorNumber: string;
  imageNormal: string | null;
};

export type DeckDetail = {
  deck: Deck;
  cards: DeckCard[];
};

export type CreateDeckInput = {
  name: string;
  description?: string | null;
  format: DeckFormat;
};

export type UpdateDeckInput = {
  name?: string;
  description?: string | null;
  format?: DeckFormat;
};

export type DeckImportUnmatched = {
  line: string;
  reason: string;
};

export type DeckImportResult = {
  imported: number;
  unmatched: DeckImportUnmatched[];
  detail: DeckDetail;
};
