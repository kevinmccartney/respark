import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SET_SEARCH_DEFAULT_SORT,
  SET_SEARCH_SORTS,
  defaultSetSortDir,
  type SetListItem,
  type SetSearchSort,
} from 'schemas/sets';
import { SORT_DIRS, type SortDir } from 'schemas/primitives';
import { Alert, AlertDescription } from '@/core/ui/alert';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/core/ui/table';
import { applyAdminLoadError, OffsetPagination } from '@/core';
import { SetTypeFilter } from '../components/SetTypeFilter.tsx';
import { SortableHead } from '../components/SortableHead.tsx';
import { searchSets } from '../lib/sets.ts';

const PAGE_SIZE = 40;

const isSetSearchSort = (value: string): value is SetSearchSort =>
  (SET_SEARCH_SORTS as readonly string[]).includes(value);

const isSortDir = (value: string): value is SortDir =>
  (SORT_DIRS as readonly string[]).includes(value);

const parseSetTypes = (raw: string): string[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export const SetsListPage = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const qParam = searchParams.get('q') ?? '';
  const setTypeParam = searchParams.get('setType') ?? '';
  const digitalParam = searchParams.get('digital');
  const sortRaw = searchParams.get('sort') ?? SET_SEARCH_DEFAULT_SORT;
  const sortParam = isSetSearchSort(sortRaw) ? sortRaw : SET_SEARCH_DEFAULT_SORT;
  const dirRaw = searchParams.get('dir');
  const dirParam = dirRaw && isSortDir(dirRaw) ? dirRaw : defaultSetSortDir(sortParam);
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [draftQ, setDraftQ] = useState(qParam);
  const [draftSetType, setDraftSetType] = useState<string[]>(() => parseSetTypes(setTypeParam));
  const [draftDigital, setDraftDigital] = useState(digitalParam ?? '');

  const [rows, setRows] = useState<SetListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(pageParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setDraftQ(qParam);
    setDraftSetType(parseSetTypes(setTypeParam));
    setDraftDigital(digitalParam ?? '');
  }, [qParam, setTypeParam, digitalParam]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        const digital =
          digitalParam === 'true' ? true : digitalParam === 'false' ? false : undefined;
        const setType = parseSetTypes(setTypeParam);
        const result = await searchSets(
          getToken,
          {
            q: qParam || undefined,
            setType: setType.length > 0 ? setType : undefined,
            digital,
            sort: sortParam,
            dir: dirParam,
            limit: PAGE_SIZE,
            page: pageParam,
          },
          { signal },
        );
        if (signal?.aborted) return;
        setRows(result.sets);
        setTotal(result.total);
        setPage(result.page);
        if (result.page !== pageParam && result.totalPages > 0) {
          const next = new URLSearchParams(searchParams);
          if (result.page <= 1) next.delete('page');
          else next.set('page', String(result.page));
          setSearchParams(next, { replace: true });
        }
      } catch (err) {
        if (signal?.aborted) return;
        applyAdminLoadError(err, { setError, setForbidden }, 'Could not load sets');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [
      getToken,
      qParam,
      setTypeParam,
      digitalParam,
      sortParam,
      dirParam,
      pageParam,
      searchParams,
      setSearchParams,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const q = draftQ.trim();
    if (q) next.set('q', q);
    if (draftSetType.length > 0) {
      next.set(
        'setType',
        draftSetType
          .map((token) => token.trim())
          .filter(Boolean)
          .join(','),
      );
    }
    if (draftDigital === 'true' || draftDigital === 'false') next.set('digital', draftDigital);
    writeSortParams(next, sortParam, dirParam);
    setSearchParams(next);
  };

  const setSort = (sort: SetSearchSort) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    const nextDir =
      sort === sortParam ? (dirParam === 'asc' ? 'desc' : 'asc') : defaultSetSortDir(sort);
    writeSortParams(next, sort, nextDir);
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const offset = (page - 1) * PAGE_SIZE;

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <header className="mb-4">
        <h1 className="font-heading text-xl font-semibold">Sets</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Read-only catalog browse. Set metadata comes from ETL syncs.
        </p>
      </header>

      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="mb-5 grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2 lg:grid-cols-4"
        onSubmit={applyFilters}
      >
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Search</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            placeholder="Name or code…"
          />
        </label>
        <SetTypeFilter value={draftSetType} onChange={setDraftSetType} />
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Digital</span>
          <select
            className="rounded-md border bg-background px-3 py-2"
            value={draftDigital}
            onChange={(event) => setDraftDigital(event.target.value)}
          >
            <option value="">Any</option>
            <option value="true">Digital only</option>
            <option value="false">Paper only</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={loading}>
            Apply
          </Button>
        </div>
      </form>

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {loading ? 'Loading…' : `${total.toLocaleString()} sets`}
      </p>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                active={sortParam === 'code'}
                dir={sortParam === 'code' ? dirParam : undefined}
                onClick={() => setSort('code')}
              >
                Code
              </SortableHead>
              <SortableHead
                active={sortParam === 'name'}
                dir={sortParam === 'name' ? dirParam : undefined}
                onClick={() => setSort('name')}
              >
                Name
              </SortableHead>
              <SortableHead
                active={sortParam === 'setType'}
                dir={sortParam === 'setType' ? dirParam : undefined}
                onClick={() => setSort('setType')}
              >
                Type
              </SortableHead>
              <SortableHead
                active={sortParam === 'releasedAt'}
                dir={sortParam === 'releasedAt' ? dirParam : undefined}
                onClick={() => setSort('releasedAt')}
              >
                Released
              </SortableHead>
              <SortableHead
                active={sortParam === 'cardCount'}
                dir={sortParam === 'cardCount' ? dirParam : undefined}
                onClick={() => setSort('cardCount')}
              >
                Cards
              </SortableHead>
              <SortableHead
                active={sortParam === 'digital'}
                dir={sortParam === 'digital' ? dirParam : undefined}
                onClick={() => setSort('digital')}
              >
                Digital
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((set) => (
              <TableRow
                key={set.id}
                className="cursor-pointer"
                onClick={() => navigate(`/catalog/sets/${set.id}`)}
              >
                <TableCell className="font-mono text-sm uppercase">
                  <Link
                    to={`/catalog/sets/${set.id}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {set.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{set.name}</TableCell>
                <TableCell className="text-muted-foreground">{set.setType ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{set.releasedAt ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{set.cardCount}</TableCell>
                <TableCell>
                  {set.digital ? <Badge variant="secondary">Digital</Badge> : '—'}
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No sets match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <OffsetPagination
        offset={offset}
        total={total}
        pageSize={PAGE_SIZE}
        loading={loading}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
      />
    </main>
  );
};

const writeSortParams = (params: URLSearchParams, sort: SetSearchSort, dir: SortDir) => {
  if (sort === SET_SEARCH_DEFAULT_SORT) params.delete('sort');
  else params.set('sort', sort);
  if (dir === defaultSetSortDir(sort)) params.delete('dir');
  else params.set('dir', dir);
};
