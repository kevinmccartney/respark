import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SET_SEARCH_DEFAULT_SORT, defaultSetSortDir, isSetSearchSort } from '@respark/schemas';
import { Badge, Button, Table, TableBody, TableCell, TableHeader, TableRow } from '@respark/ui/lib';

import {
  AdminLoadErrorAlert,
  OffsetPagination,
  SortableTableHead,
} from '@respark-admin/core/components';
import { useClampPageParam, useUrlSortParams } from '@respark-admin/core/hooks';
import { SetTypeFilter } from '@respark-admin/sets/components';
import { SETS_LIST_PAGE_SIZE } from '@respark-admin/sets/constants';
import { useSearchSets } from '@respark-admin/sets/hooks';
const parseSetTypes = (raw: string): string[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export const SetsListPage = () => {
  const navigate = useNavigate();
  const {
    searchParams,
    setSearchParams,
    sortParam,
    dirParam,
    pageParam,
    setSort,
    goToPage,
    writeSortParams,
  } = useUrlSortParams({
    defaultSort: SET_SEARCH_DEFAULT_SORT,
    isSort: isSetSearchSort,
    defaultDir: defaultSetSortDir,
  });

  const qParam = searchParams.get('q') ?? '';
  const setTypeParam = searchParams.get('setType') ?? '';
  const digitalParam = searchParams.get('digital');

  const [draftQ, setDraftQ] = useState(qParam);
  const [draftSetType, setDraftSetType] = useState<string[]>(() => parseSetTypes(setTypeParam));
  const [draftDigital, setDraftDigital] = useState(digitalParam ?? '');

  useEffect(() => {
    setDraftQ(qParam);
    setDraftSetType(parseSetTypes(setTypeParam));
    setDraftDigital(digitalParam ?? '');
  }, [qParam, setTypeParam, digitalParam]);

  const digital = digitalParam === 'true' ? true : digitalParam === 'false' ? false : undefined;
  const setType = parseSetTypes(setTypeParam);

  const { data, isPending, isFetching, error } = useSearchSets({
    q: qParam || undefined,
    setType: setType.length > 0 ? setType : undefined,
    digital,
    sort: sortParam,
    dir: dirParam,
    limit: SETS_LIST_PAGE_SIZE,
    page: pageParam,
  });

  useClampPageParam(data ? { page: data.page, totalPages: data.totalPages } : undefined, pageParam);

  const applyFilters = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const q = draftQ.trim();
    if (q) {
      next.set('q', q);
    }
    if (draftSetType.length > 0) {
      next.set(
        'setType',
        draftSetType
          .map((token) => token.trim())
          .filter(Boolean)
          .join(','),
      );
    }
    if (draftDigital === 'true' || draftDigital === 'false') {
      next.set('digital', draftDigital);
    }
    writeSortParams(next, sortParam, dirParam);
    setSearchParams(next);
  };

  const rows = data?.sets ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? pageParam;
  const loading = isPending || isFetching;
  const offset = (page - 1) * SETS_LIST_PAGE_SIZE;

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <header className="mb-4">
        <h1 className="font-heading text-xl font-semibold">Sets</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Read-only catalog browse. Set metadata comes from ETL syncs.
        </p>
      </header>

      <AdminLoadErrorAlert error={error} fallback="Could not load sets" />

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
        {isPending ? 'Loading…' : `${total.toLocaleString()} sets`}
      </p>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                active={sortParam === 'code'}
                dir={sortParam === 'code' ? dirParam : undefined}
                onClick={() => setSort('code')}
              >
                Code
              </SortableTableHead>
              <SortableTableHead
                active={sortParam === 'name'}
                dir={sortParam === 'name' ? dirParam : undefined}
                onClick={() => setSort('name')}
              >
                Name
              </SortableTableHead>
              <SortableTableHead
                active={sortParam === 'setType'}
                dir={sortParam === 'setType' ? dirParam : undefined}
                onClick={() => setSort('setType')}
              >
                Type
              </SortableTableHead>
              <SortableTableHead
                active={sortParam === 'releasedAt'}
                dir={sortParam === 'releasedAt' ? dirParam : undefined}
                onClick={() => setSort('releasedAt')}
              >
                Released
              </SortableTableHead>
              <SortableTableHead
                active={sortParam === 'cardCount'}
                dir={sortParam === 'cardCount' ? dirParam : undefined}
                onClick={() => setSort('cardCount')}
              >
                Cards
              </SortableTableHead>
              <SortableTableHead
                active={sortParam === 'digital'}
                dir={sortParam === 'digital' ? dirParam : undefined}
                onClick={() => setSort('digital')}
              >
                Digital
              </SortableTableHead>
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
            {!isPending && rows.length === 0 ? (
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
        pageSize={SETS_LIST_PAGE_SIZE}
        loading={loading}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
      />
    </main>
  );
};
