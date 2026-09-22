import type { SortDir } from '@respark/schemas';

export const parsePageParam = (searchParams: URLSearchParams): number =>
  Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

export const setPageParam = (params: URLSearchParams, page: number): void => {
  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }
};

export const writeSortSearchParams = <TSort extends string>(
  params: URLSearchParams,
  sort: TSort,
  dir: SortDir,
  opts: {
    defaultSort: TSort;
    defaultDir: (sort: TSort) => SortDir;
  },
): void => {
  if (sort === opts.defaultSort) {
    params.delete('sort');
  } else {
    params.set('sort', sort);
  }
  if (dir === opts.defaultDir(sort)) {
    params.delete('dir');
  } else {
    params.set('dir', dir);
  }
};
