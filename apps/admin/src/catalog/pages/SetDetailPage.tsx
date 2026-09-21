import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  SET_PRINTING_DEFAULT_SORT,
  SET_PRINTING_SORTS,
  defaultSetPrintingSortDir,
  type SetDetail,
  type SetPrintingSort,
} from 'schemas/sets';
import { SORT_DIRS, uuidSchema, type SortDir } from 'schemas/primitives';
import { Alert, AlertDescription } from '@/core/ui/alert';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/ui/table';
import { applyAdminLoadError, isNotFound, NotFoundPage, OffsetPagination } from '@/core';
import { CardThumb } from '../components/CardThumb.tsx';
import { SortableHead } from '../components/SortableHead.tsx';
import { fetchSet } from '../lib/sets.ts';

const PAGE_SIZE = 50;

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError';

const isSetPrintingSort = (value: string): value is SetPrintingSort =>
  (SET_PRINTING_SORTS as readonly string[]).includes(value);

const isSortDir = (value: string): value is SortDir =>
  (SORT_DIRS as readonly string[]).includes(value);

export const SetDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const sortRaw = searchParams.get('sort') ?? SET_PRINTING_DEFAULT_SORT;
  const sortParam = isSetPrintingSort(sortRaw) ? sortRaw : SET_PRINTING_DEFAULT_SORT;
  const dirRaw = searchParams.get('dir');
  const dirParam = dirRaw && isSortDir(dirRaw) ? dirRaw : defaultSetPrintingSortDir(sortParam);

  const [set, setSet] = useState<SetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      setNotFound(false);
      if (!uuidSchema.safeParse(id).success) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const detail = await fetchSet(
          getToken,
          id,
          {
            sort: sortParam,
            dir: dirParam,
            limit: PAGE_SIZE,
            page: pageParam,
          },
          { signal },
        );
        if (signal?.aborted) return;
        setSet(detail);
        if (detail.printingsPage !== pageParam && detail.printingsTotalPages > 0) {
          const next = new URLSearchParams(searchParams);
          if (detail.printingsPage <= 1) next.delete('page');
          else next.set('page', String(detail.printingsPage));
          setSearchParams(next, { replace: true });
        }
      } catch (err) {
        if (isAbortError(err) || signal?.aborted) return;
        if (isNotFound(err)) {
          setNotFound(true);
          return;
        }
        applyAdminLoadError(err, { setError, setForbidden }, 'Could not load set');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [getToken, id, sortParam, dirParam, pageParam, searchParams, setSearchParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    if (id) void load(controller.signal);
    return () => controller.abort();
  }, [id, load]);

  const setSort = (sort: SetPrintingSort) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    const nextDir =
      sort === sortParam ? (dirParam === 'asc' ? 'desc' : 'asc') : defaultSetPrintingSortDir(sort);
    writePrintingSortParams(next, sort, nextDir);
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setSearchParams(next);
  };

  if (notFound) {
    return (
      <NotFoundPage
        title="Set not found"
        description="That set is not in the catalog — it may not have been ingested yet."
      />
    );
  }

  const page = set?.printingsPage ?? pageParam;
  const total = set?.printingsTotal ?? 0;
  const offset = (page - 1) * PAGE_SIZE;

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <div className="mb-4">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !set ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading set…
        </p>
      ) : null}

      {set ? (
        <div className="space-y-6">
          <header className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-heading text-2xl font-semibold">{set.name}</h1>
              <span className="font-mono text-sm uppercase text-muted-foreground">{set.code}</span>
              {set.digital ? <Badge variant="secondary">Digital</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Read-only catalog data from ETL. Open a printing to jump into the card detail.
            </p>
            <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{set.setType ?? '—'}</dd>
              <dt className="text-muted-foreground">Released</dt>
              <dd>{set.releasedAt ?? '—'}</dd>
              <dt className="text-muted-foreground">Card count</dt>
              <dd>{set.cardCount}</dd>
              {set.scryfallId ? (
                <>
                  <dt className="text-muted-foreground">Scryfall id</dt>
                  <dd className="font-mono text-xs">{set.scryfallId}</dd>
                </>
              ) : null}
              {set.parentSetCode ? (
                <>
                  <dt className="text-muted-foreground">Parent set</dt>
                  <dd className="font-mono uppercase">{set.parentSetCode}</dd>
                </>
              ) : null}
              {set.block || set.blockCode ? (
                <>
                  <dt className="text-muted-foreground">Block</dt>
                  <dd>
                    {set.block ?? '—'}
                    {set.blockCode ? (
                      <span className="ml-2 font-mono text-xs uppercase text-muted-foreground">
                        {set.blockCode}
                      </span>
                    ) : null}
                  </dd>
                </>
              ) : null}
            </dl>
          </header>

          <section className="space-y-3" aria-labelledby="set-printings-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="set-printings-heading" className="font-heading text-xl">
                Printings
              </h2>
              <Badge variant="secondary">{total.toLocaleString()}</Badge>
            </div>

            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <SortableHead
                      active={sortParam === 'collectorNumber'}
                      dir={sortParam === 'collectorNumber' ? dirParam : undefined}
                      onClick={() => setSort('collectorNumber')}
                    >
                      #
                    </SortableHead>
                    <SortableHead
                      active={sortParam === 'name'}
                      dir={sortParam === 'name' ? dirParam : undefined}
                      onClick={() => setSort('name')}
                    >
                      Card
                    </SortableHead>
                    <SortableHead
                      active={sortParam === 'rarity'}
                      dir={sortParam === 'rarity' ? dirParam : undefined}
                      onClick={() => setSort('rarity')}
                    >
                      Rarity
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {set.printings.map((printing) => (
                    <TableRow key={printing.id}>
                      <TableCell>
                        <CardThumb src={printing.imageNormal} alt="" />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {printing.collectorNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          to={`/catalog/cards/${printing.cardId}?printing=${printing.id}`}
                          className="hover:underline"
                        >
                          {printing.cardName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {printing.rarity ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && set.printings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No printings in this set.
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
          </section>
        </div>
      ) : null}
    </main>
  );
};

const writePrintingSortParams = (params: URLSearchParams, sort: SetPrintingSort, dir: SortDir) => {
  if (sort === SET_PRINTING_DEFAULT_SORT) params.delete('sort');
  else params.set('sort', sort);
  if (dir === defaultSetPrintingSortDir(sort)) params.delete('dir');
  else params.set('dir', dir);
};
