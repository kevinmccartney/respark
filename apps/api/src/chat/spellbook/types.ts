export type SpellbookDeckCard = {
  card: string;
  quantity: number;
};

export type SpellbookDecklist = {
  commanders: SpellbookDeckCard[];
  main: SpellbookDeckCard[];
};

export type SpellbookCardUse = {
  name: string;
  oracleId: string | null;
};

export type SpellbookVariantSlice = {
  id: string;
  uses: SpellbookCardUse[];
  produces: string[];
  manaNeeded: string | null;
  description: string | null;
  popularity: number | null;
  bracketTag: string | null;
};

export type FindMyCombosResult = {
  included: SpellbookVariantSlice[];
  almostIncluded: SpellbookVariantSlice[];
};

export type SpellbookClient = {
  findMyCombos: (decklist: SpellbookDecklist) => Promise<FindMyCombosResult>;
  searchVariants: (q: string, limit: number) => Promise<SpellbookVariantSlice[]>;
};

export class SpellbookUpstreamError extends Error {
  readonly code = 'upstream' as const;

  constructor(message = 'Could not load Commander Spellbook') {
    super(message);
    this.name = 'SpellbookUpstreamError';
  }
}
