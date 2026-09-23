import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription, Button, Input, Label } from '@respark/ui/lib';

import { ApiError } from '@respark-client/core';

import { ScryfallSyntaxDialog } from '../components/ScryfallSyntaxDialog';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, SEARCH_DEBOUNCE_MS } from '../constants';
import { useSearchCards } from '../hooks/cards';
import type { PageSize } from '../types';

const parsePageSize = (raw: string | null): PageSize => {
  const n = Number.parseInt(raw ?? '', 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
};

const parsePage = (raw: string | null): number => {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

export const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const scryfallParam = searchParams.get('scryfall') ?? '';
  const pageSize = parsePageSize(searchParams.get('pageSize'));
  const pageParam = parsePage(searchParams.get('page'));

  const [scryfallInput, setScryfallInput] = useState(scryfallParam);
  const [syntaxOpen, setSyntaxOpen] = useState(false);

  const {
    data,
    isPending,
    error: queryError,
  } = useSearchCards({
    scryfall: scryfallParam || undefined,
    limit: pageSize,
    page: pageParam,
  });

  const cards = data?.cards ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? pageParam;
  const totalPages = data?.totalPages ?? 0;
  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError
        ? 'Could not search cards'
        : null;

  useEffect(() => {
    setScryfallInput(scryfallParam);
  }, [scryfallParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmedScryfall = scryfallInput.trim();
      const currentScryfall = (searchParams.get('scryfall') ?? '').trim();
      if (trimmedScryfall === currentScryfall) return;
      const next = new URLSearchParams(searchParams);
      if (trimmedScryfall) next.set('scryfall', trimmedScryfall);
      else next.delete('scryfall');
      next.delete('page');
      setSearchParams(next, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [scryfallInput, searchParams, setSearchParams]);

  useEffect(() => {
    if (!data || data.page === pageParam || data.totalPages === 0) return;
    const next = new URLSearchParams(searchParams);
    if (data.page <= 1) next.delete('page');
    else next.set('page', String(data.page));
    setSearchParams(next, { replace: true });
  }, [data, pageParam, searchParams, setSearchParams]);

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };

  const setPageSize = (nextSize: PageSize) => {
    updateParams((next) => {
      if (nextSize === DEFAULT_PAGE_SIZE) next.delete('pageSize');
      else next.set('pageSize', String(nextSize));
      next.delete('page');
    });
  };

  const goToPage = (nextPage: number) => {
    updateParams((next) => {
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
    });
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const hasQuery = Boolean(scryfallParam.trim());

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="space-y-3 text-left">
        <h1 className="font-heading text-3xl tracking-tight">Card search</h1>
        <p className="max-w-2xl text-muted-foreground">
          Search with Scryfall syntax (colors, types, oracle, mana, rarity, sets, format). See{' '}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => setSyntaxOpen(true)}
          >
            supported syntax
          </button>
          . Unsupported keywords return an error.
        </p>
        <div className="flex max-w-2xl flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="scryfall-search">Scryfall query</Label>
            <Input
              id="scryfall-search"
              value={scryfallInput}
              onChange={(event) => setScryfallInput(event.target.value)}
              placeholder="t:creature id:g f:commander mv<=3"
              aria-label="Scryfall syntax search"
              spellCheck={false}
              className="font-mono text-[0.9em]"
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

      <ScryfallSyntaxDialog open={syntaxOpen} onOpenChange={setSyntaxOpen} />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isPending ? (
        <p className="text-muted-foreground" aria-live="polite">
          Searching…
        </p>
      ) : null}

      {!isPending && !error && cards.length === 0 ? (
        <p className="text-muted-foreground">
          {hasQuery ? 'No cards match this search.' : 'No cards in the catalog yet.'}
        </p>
      ) : null}

      {!isPending && cards.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {rangeStart}-{rangeEnd} of {total} card
              {total === 1 ? '' : 's'}.
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
  );
};

const PaginationControls = ({
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
}) => {
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
};
