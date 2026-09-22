import type { CardSearchSort, SortDir } from '@respark/schemas';

export type CardSearchOpts = {
  scryfall?: string;
  sort?: CardSearchSort;
  dir?: SortDir;
  limit?: number;
  page?: number;
};
