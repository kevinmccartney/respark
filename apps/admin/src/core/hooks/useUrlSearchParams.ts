import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isSortDir, type SortDir } from '@respark/schemas';

import { parsePageParam, setPageParam, writeSortSearchParams } from '../lib/search-params';

type ClampPageResponse =
  | {
      page: number;
      totalPages: number;
    }
  | null
  | undefined;

/** Keep `?page=` in sync when the API clamps/corrects the requested page. */
export const useClampPageParam = (response: ClampPageResponse, pageParam: number) => {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!response || response.totalPages === 0 || response.page === pageParam) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    setPageParam(next, response.page);
    setSearchParams(next, { replace: true });
  }, [response, pageParam, searchParams, setSearchParams]);
};

type UrlSortParamsOpts<TSort extends string> = {
  defaultSort: TSort;
  isSort: (value: string) => value is TSort;
  defaultDir: (sort: TSort) => SortDir;
};

/** Parse/write `sort`, `dir`, and `page` search params with toggle-on-repeat-column behavior. */
export const useUrlSortParams = <TSort extends string>({
  defaultSort,
  isSort,
  defaultDir,
}: UrlSortParamsOpts<TSort>) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const sortRaw = searchParams.get('sort') ?? defaultSort;
  const sortParam = isSort(sortRaw) ? sortRaw : defaultSort;
  const dirRaw = searchParams.get('dir');
  const dirParam = dirRaw && isSortDir(dirRaw) ? dirRaw : defaultDir(sortParam);
  const pageParam = parsePageParam(searchParams);

  const setSort = (sort: TSort) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    const nextDir = sort === sortParam ? (dirParam === 'asc' ? 'desc' : 'asc') : defaultDir(sort);
    writeSortSearchParams(next, sort, nextDir, { defaultSort, defaultDir });
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    setPageParam(next, nextPage);
    setSearchParams(next);
  };

  return {
    searchParams,
    setSearchParams,
    sortParam,
    dirParam,
    pageParam,
    setSort,
    goToPage,
    writeSortParams: (params: URLSearchParams, sort: TSort, dir: SortDir) => {
      writeSortSearchParams(params, sort, dir, { defaultSort, defaultDir });
    },
  };
};
