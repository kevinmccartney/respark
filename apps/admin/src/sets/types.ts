import type { SetPrintingSort, SetSearchSort, SortDir } from '@respark/schemas';

export type SetSearchOpts = {
  q?: string;
  setType?: string | string[];
  digital?: boolean;
  sort?: SetSearchSort;
  dir?: SortDir;
  limit?: number;
  page?: number;
};

export type SetDetailOpts = {
  sort?: SetPrintingSort;
  dir?: SortDir;
  limit?: number;
  page?: number;
};
