import { cn } from 'cn';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  CARD_SEARCH_DEFAULT_SORT,
  defaultCardSortDir,
  DECK_FORMATS,
  isCardSearchSort,
  type CardSearchResult,
  type DeckFormat,
} from '@respark/schemas';
import {
  Badge,
  Button,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useScrollVisibility,
} from '@respark/ui/lib';
import { ManaCost } from '@respark/ui/mana';

import { CardThumb, ScryfallSyntaxDialog } from '@respark-admin/cards/components';
import { CARDS_LIST_PAGE_SIZE } from '@respark-admin/cards/constants';
import { useSearchCards } from '@respark-admin/cards/hooks';
import { AdminLoadErrorAlert, SortableTableHead } from '@respark-admin/core/components';
import { useClampPageParam, useUrlSortParams } from '@respark-admin/core/hooks';

const FORMAT_SHORT: Record<DeckFormat, string> = {
  standard: 'Std',
  commander: 'Cmd',
  modern: 'Mod',
};
const CELL_PAD = 'px-4 py-3';

const formatLegalities = (card: CardSearchResult): string => {
  if (!card.legalities) {
    return '—';
  }
  const legal = DECK_FORMATS.filter((format) => card.legalities?.[format] === 'legal').map(
    (format) => FORMAT_SHORT[format],
  );
  return legal.length > 0 ? legal.join(', ') : '—';
};

const formatRarity = (rarity: string | null): string => {
  if (!rarity) {
    return '—';
  }
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export const CardsListPage = () => {
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
    defaultSort: CARD_SEARCH_DEFAULT_SORT,
    isSort: isCardSearchSort,
    defaultDir: defaultCardSortDir,
  });

  const scryfallParam = searchParams.get('scryfall') ?? '';
  const [draftScryfall, setDraftScryfall] = useState(scryfallParam);
  const [syntaxOpen, setSyntaxOpen] = useState(false);

  useEffect(() => {
    setDraftScryfall(scryfallParam);
  }, [scryfallParam]);

  const { data, isPending, isFetching, error } = useSearchCards({
    scryfall: scryfallParam || undefined,
    sort: sortParam,
    dir: dirParam,
    limit: CARDS_LIST_PAGE_SIZE,
    page: pageParam,
  });

  useClampPageParam(
    data ? { page: data.page, totalPages: data.totalPages } : undefined,
    pageParam,
    !isFetching,
  );

  const applyFilters = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const scryfall = draftScryfall.trim();
    if (scryfall) {
      next.set('scryfall', scryfall);
    }
    writeSortParams(next, sortParam, dirParam);
    setSearchParams(next);
  };

  const rows = data?.cards ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? pageParam;
  const totalPages = data?.totalPages ?? 0;
  const loading = isPending || isFetching;
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { visible: paginationVisible, ref: paginationRef } = useScrollVisibility(
    'show-on-scroll-down',
    { scrollerRef: tableScrollRef },
  );

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-5 py-5">
      <header className="mb-4 shrink-0">
        <h1 className="font-heading text-xl font-semibold">Cards</h1>
      </header>

      <div className="shrink-0">
        <AdminLoadErrorAlert error={error} fallback="Could not load cards" />
      </div>

      <form
        className="mb-5 flex shrink-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-end"
        onSubmit={applyFilters}
      >
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          <span className="text-muted-foreground">
            Scryfall query{' '}
            <button
              type="button"
              className="text-foreground underline-offset-2 hover:underline"
              onClick={() => setSyntaxOpen(true)}
            >
              syntax
            </button>
          </span>
          <input
            className="rounded-md border bg-background px-3 py-2 font-mono text-[0.9em]"
            value={draftScryfall}
            onChange={(event) => setDraftScryfall(event.target.value)}
            placeholder="Markov t:vampire"
            spellCheck={false}
          />
        </label>
        <Button type="submit" disabled={loading}>
          Apply
        </Button>
      </form>

      <ScryfallSyntaxDialog open={syntaxOpen} onOpenChange={setSyntaxOpen} />

      <p className="mb-2 shrink-0 text-sm text-muted-foreground" aria-live="polite">
        {isPending ? 'Loading…' : `${total.toLocaleString()} cards`}
      </p>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table
          className="min-w-4xl"
          containerRef={tableScrollRef}
          containerClassName="min-h-0 flex-1 overflow-auto pb-14"
        >
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`w-16 min-w-16 ${CELL_PAD}`} />
              <SortableTableHead
                active={sortParam === 'name'}
                dir={sortParam === 'name' ? dirParam : undefined}
                onClick={() => setSort('name')}
                className={CELL_PAD}
              >
                Name
              </SortableTableHead>
              <TableHead className={CELL_PAD}>Type</TableHead>
              <SortableTableHead
                active={sortParam === 'manaValue'}
                dir={sortParam === 'manaValue' ? dirParam : undefined}
                onClick={() => setSort('manaValue')}
                className={CELL_PAD}
              >
                Mana
              </SortableTableHead>
              <TableHead className={CELL_PAD}>Rarity</TableHead>
              <TableHead className={CELL_PAD}>Legal</TableHead>
              <TableHead className={CELL_PAD}>Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((card) => (
              <TableRow
                key={card.id}
                className="cursor-pointer"
                onClick={() => navigate(`/catalog/cards/${card.id}`)}
              >
                <TableCell
                  className={`w-16 min-w-16 ${CELL_PAD}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <CardThumb src={card.imageNormal} alt="" />
                </TableCell>
                <TableCell className={`min-w-44 font-medium ${CELL_PAD}`}>
                  <Link
                    to={`/catalog/cards/${card.id}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {card.name}
                  </Link>
                </TableCell>
                <TableCell
                  className={`min-w-52 max-w-72 truncate text-muted-foreground ${CELL_PAD}`}
                >
                  {card.typeLine ?? '—'}
                </TableCell>
                <TableCell className={`min-w-28 ${CELL_PAD}`}>
                  {card.manaCost ? <ManaCost cost={card.manaCost} size={14} /> : '—'}
                </TableCell>
                <TableCell className={`min-w-28 text-muted-foreground ${CELL_PAD}`}>
                  {formatRarity(card.rarity)}
                </TableCell>
                <TableCell className={`min-w-28 text-muted-foreground ${CELL_PAD}`}>
                  {formatLegalities(card)}
                </TableCell>
                <TableCell className={`min-w-36 ${CELL_PAD}`}>
                  <div className="flex flex-wrap gap-1">
                    {card.isGameChanger ? <Badge variant="secondary">GC</Badge> : null}
                    {card.goodstuff ? (
                      <Badge variant="outline" title={card.goodstuff.tags.join(', ')}>
                        GS
                        {card.goodstuff.tags.length
                          ? `: ${card.goodstuff.tags.slice(0, 2).join(', ')}${
                              card.goodstuff.tags.length > 2 ? '…' : ''
                            }`
                          : ''}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isPending && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={`text-muted-foreground ${CELL_PAD}`}>
                  No cards match these filters.
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
    </main>
  );
};
