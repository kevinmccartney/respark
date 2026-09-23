import { cn } from 'cn';
import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  SET_PRINTING_DEFAULT_SORT,
  defaultSetPrintingSortDir,
  isSetPrintingSort,
  uuidSchema,
} from '@respark/schemas';
import {
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useScrollVisibility,
} from '@respark/ui/lib';

import { CardThumb } from '@respark-admin/cards/components';
import { DetailShell, SortableTableHead } from '@respark-admin/core/components';
import { useClampPageParam, useUrlSortParams } from '@respark-admin/core/hooks';
import { adminQueryErrorState } from '@respark-admin/core/lib';
import { SET_PRINTINGS_PAGE_SIZE } from '@respark-admin/sets/constants';
import { useSet } from '@respark-admin/sets/hooks';
export const SetDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { sortParam, dirParam, pageParam, setSort, goToPage } = useUrlSortParams({
    defaultSort: SET_PRINTING_DEFAULT_SORT,
    isSort: isSetPrintingSort,
    defaultDir: defaultSetPrintingSortDir,
  });

  const validId = uuidSchema.safeParse(id).success;
  const {
    data: set,
    isPending,
    isFetching,
    error,
  } = useSet(id, {
    sort: sortParam,
    dir: dirParam,
    limit: SET_PRINTINGS_PAGE_SIZE,
    page: pageParam,
  });

  const { notFound } = adminQueryErrorState(error, 'Could not load set');

  useClampPageParam(
    set ? { page: set.printingsPage, totalPages: set.printingsTotalPages } : undefined,
    pageParam,
    !isFetching,
  );

  const loading = isPending || isFetching;
  const page = set?.printingsPage ?? pageParam;
  const total = set?.printingsTotal ?? 0;
  const totalPages = set?.printingsTotalPages ?? 0;
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { visible: paginationVisible, ref: paginationRef } = useScrollVisibility(
    'show-on-scroll-down',
    { scrollerRef: tableScrollRef, enabled: Boolean(set) },
  );

  return (
    <DetailShell
      fill
      notFound={
        !validId || notFound
          ? {
              title: 'Set not found',
              description: 'That set is not in the catalog. Typo or bug? You decide!',
            }
          : null
      }
      error={error}
      errorFallback="Could not load set"
      loading={isPending && !set}
      loadingLabel="Loading set…"
    >
      {set ? (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
          <header className="shrink-0 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-heading text-2xl font-semibold">{set.name}</h1>
              <span className="font-mono text-sm uppercase text-muted-foreground">{set.code}</span>
            </div>
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

          <section
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
            aria-labelledby="set-printings-heading"
          >
            <div className="flex shrink-0 items-baseline justify-between gap-3">
              <h2 id="set-printings-heading" className="font-heading text-xl">
                Printings
              </h2>
              <Badge variant="secondary">{total.toLocaleString()}</Badge>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              <Table
                containerRef={tableScrollRef}
                containerClassName="min-h-0 flex-1 overflow-auto pb-14"
              >
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_0_var(--border)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12" />
                    <SortableTableHead
                      active={sortParam === 'collectorNumber'}
                      dir={sortParam === 'collectorNumber' ? dirParam : undefined}
                      onClick={() => setSort('collectorNumber')}
                    >
                      #
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortParam === 'name'}
                      dir={sortParam === 'name' ? dirParam : undefined}
                      onClick={() => setSort('name')}
                    >
                      Card
                    </SortableTableHead>
                    <SortableTableHead
                      active={sortParam === 'rarity'}
                      dir={sortParam === 'rarity' ? dirParam : undefined}
                      onClick={() => setSort('rarity')}
                    >
                      Rarity
                    </SortableTableHead>
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
                  {!isPending && set.printings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No printings in this set.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <div
                ref={paginationRef}
                className={cn(
                  'absolute inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-2 py-1 backdrop-blur transition-transform duration-200 supports-backdrop-filter:bg-card/80',
                  paginationVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
                )}
              >
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  disabled={loading}
                  onPageChange={goToPage}
                  className="mt-0"
                />
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </DetailShell>
  );
};
