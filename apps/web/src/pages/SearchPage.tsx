import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { ApiError } from '../lib/api.ts';
import { searchCards, type CardSearchResult } from '../lib/cards.ts';

const PAGE_SIZE_OPTIONS = [24, 60, 100] as const;
const DEFAULT_PAGE_SIZE = 60;
const DEBOUNCE_MS = 300;

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function parsePageSize(raw: string | null): PageSize {
  const n = Number.parseInt(raw ?? '', 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function SearchPage() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const pageSize = parsePageSize(searchParams.get('pageSize'));
  const pageParam = parsePage(searchParams.get('page'));
  const searchReturnTo = searchParams.toString() ? `/search?${searchParams.toString()}` : '/search';

  const [input, setInput] = useState(qParam);
  const [cards, setCards] = useState<CardSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(pageParam);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep local input in sync when the URL changes (back/forward).
  useEffect(() => {
    setInput(qParam);
  }, [qParam]);

  // Debounce URL updates from typing; reset to page 1 on query change.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = input.trim();
      const current = (searchParams.get('q') ?? '').trim();
      if (trimmed === current) return;
      const next = new URLSearchParams(searchParams);
      if (trimmed) next.set('q', trimmed);
      else next.delete('q');
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [input, searchParams, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await searchCards(getToken, {
          q: qParam,
          limit: pageSize,
          page: pageParam,
        });
        if (controller.signal.aborted) return;
        setCards(result.cards);
        setTotal(result.total);
        setPage(result.page);
        setTotalPages(result.totalPages);
        // If the API clamped the page (e.g. past end), sync the URL.
        if (result.page !== pageParam && result.totalPages > 0) {
          const next = new URLSearchParams(searchParams);
          if (result.page <= 1) next.delete('page');
          else next.set('page', String(result.page));
          setSearchParams(next, { replace: true });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Could not search cards');
        setCards([]);
        setTotal(0);
        setPage(1);
        setTotalPages(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
    // searchParams / setSearchParams omitted: only refetch on q/page/pageSize.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [getToken, qParam, pageSize, pageParam]);

  function updateParams(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  }

  function setPageSize(nextSize: PageSize) {
    updateParams((next) => {
      if (nextSize === DEFAULT_PAGE_SIZE) next.delete('pageSize');
      else next.set('pageSize', String(nextSize));
      next.delete('page');
    });
  }

  function goToPage(nextPage: number) {
    updateParams((next) => {
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
    });
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <header className="space-y-3 text-left">
          <h1 className="font-heading text-3xl tracking-tight">Card search</h1>
          <p className="max-w-2xl text-muted-foreground">
            Keyword search across names, type lines, oracle text, and keywords.
          </p>
          <div className="flex max-w-xl flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="card-search">Search</Label>
              <Input
                id="card-search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search cards (e.g. urza)"
                aria-label="Search cards"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-size">Page size</Label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-muted-foreground" aria-live="polite">
            Searching…
          </p>
        ) : null}

        {!loading && !error && cards.length === 0 ? (
          <p className="text-muted-foreground">
            {qParam.trim() ? `No cards match “${qParam.trim()}”.` : 'No cards in the catalog yet.'}
          </p>
        ) : null}

        {!loading && cards.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Showing {rangeStart}–{rangeEnd} of {total} card
                {total === 1 ? '' : 's'}
                {qParam.trim() ? ` for “${qParam.trim()}”` : ''}.
              </p>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onFirst={() => goToPage(1)}
                onPrev={() => goToPage(page - 1)}
                onNext={() => goToPage(page + 1)}
                onLast={() => goToPage(totalPages)}
              />
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {cards.map((card) => (
                <li key={card.id}>
                  <Link
                    to={`/cards/${card.id}`}
                    state={{ fromSearch: searchReturnTo }}
                    className="flex flex-col gap-2 text-left transition-opacity hover:opacity-90"
                  >
                    <div className="aspect-5/7 overflow-hidden rounded-md bg-muted">
                      {card.imageNormal ? (
                        <img
                          src={card.imageNormal}
                          alt={card.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{card.name}</p>
                      {card.typeLine ? (
                        <p className="truncate text-sm text-muted-foreground">{card.typeLine}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex justify-center py-2">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onFirst={() => goToPage(1)}
                onPrev={() => goToPage(page - 1)}
                onNext={() => goToPage(page + 1)}
                onLast={() => goToPage(totalPages)}
              />
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}

function PaginationControls({
  page,
  totalPages,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: {
  page: number;
  totalPages: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}) {
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav className="flex items-center gap-2" aria-label="Pagination">
      <Button type="button" variant="outline" size="sm" onClick={onFirst} disabled={atStart}>
        First
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onPrev} disabled={atStart}>
        Previous
      </Button>
      <span className="px-1 text-sm text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={atEnd}>
        Next
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onLast} disabled={atEnd}>
        Last
      </Button>
    </nav>
  );
}
