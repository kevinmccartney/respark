import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CARD_SEARCH_COLOR_FILTERS,
  CARD_SEARCH_DEFAULT_SORT,
  CARD_SEARCH_RARITIES,
  CARD_SEARCH_SORTS,
  defaultCardSortDir,
  type CardSearchColorFilter,
  type CardSearchRarity,
  type CardSearchResult,
  type CardSearchSort,
} from 'schemas/cards';
import { DECK_FORMATS, type DeckFormat } from 'schemas/decks';
import { SORT_DIRS, type SortDir } from 'schemas/primitives';
import { ManaCost } from 'ui/mana';
import { Alert, AlertDescription } from '@/core/ui/alert';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/ui/table';
import { applyAdminLoadError, OffsetPagination } from '@/core';
import { ColorIdentityFilter } from '../components/ColorIdentityFilter.tsx';
import { CardThumb } from '../components/CardThumb.tsx';
import { LegalInFilter } from '../components/LegalInFilter.tsx';
import { RarityFilter } from '../components/RarityFilter.tsx';
import { SortableHead } from '../components/SortableHead.tsx';
import { TypeContainsField } from '../components/TypeContainsField.tsx';
import { searchCards } from '../lib/cards.ts';

const PAGE_SIZE = 40;

const FORMAT_SHORT: Record<DeckFormat, string> = {
  standard: 'Std',
  commander: 'Cmd',
  modern: 'Mod',
};

const isCardSearchSort = (value: string): value is CardSearchSort =>
  (CARD_SEARCH_SORTS as readonly string[]).includes(value);

const isSortDir = (value: string): value is SortDir =>
  (SORT_DIRS as readonly string[]).includes(value);

const parseColorIdentity = (raw: string): CardSearchColorFilter[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is CardSearchColorFilter =>
      (CARD_SEARCH_COLOR_FILTERS as readonly string[]).includes(part),
    );

const parseLegalIn = (raw: string): DeckFormat[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is DeckFormat => (DECK_FORMATS as readonly string[]).includes(part));

const parseTypeContains = (raw: string): string[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const parseRarity = (raw: string): CardSearchRarity[] =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is CardSearchRarity =>
      (CARD_SEARCH_RARITIES as readonly string[]).includes(part),
    );

const formatLegalities = (card: CardSearchResult): string => {
  if (!card.legalities) return '—';
  const legal = DECK_FORMATS.filter((format) => card.legalities?.[format] === 'legal').map(
    (format) => FORMAT_SHORT[format],
  );
  return legal.length > 0 ? legal.join(', ') : '—';
};

const formatRarity = (rarity: string | null): string => {
  if (!rarity) return '—';
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const cellPad = 'px-4 py-3';

export const CardsListPage = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const qParam = searchParams.get('q') ?? '';
  const scryfallParam = searchParams.get('scryfall') ?? '';
  const legalInParam = searchParams.get('legalIn') ?? '';
  const colorIdentityParam = searchParams.get('colorIdentity') ?? '';
  const typeContainsParam = searchParams.get('typeContains') ?? '';
  const rarityParam = searchParams.get('rarity') ?? '';
  const sortRaw = searchParams.get('sort') ?? CARD_SEARCH_DEFAULT_SORT;
  const sortParam = isCardSearchSort(sortRaw) ? sortRaw : CARD_SEARCH_DEFAULT_SORT;
  const dirRaw = searchParams.get('dir');
  const dirParam = dirRaw && isSortDir(dirRaw) ? dirRaw : defaultCardSortDir(sortParam);
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [draftQ, setDraftQ] = useState(qParam);
  const [draftScryfall, setDraftScryfall] = useState(scryfallParam);
  const [draftLegalIn, setDraftLegalIn] = useState<DeckFormat[]>(() => parseLegalIn(legalInParam));
  const [draftColorIdentity, setDraftColorIdentity] = useState<CardSearchColorFilter[]>(() =>
    parseColorIdentity(colorIdentityParam),
  );
  const [draftTypeContains, setDraftTypeContains] = useState<string[]>(() =>
    parseTypeContains(typeContainsParam),
  );
  const [draftRarity, setDraftRarity] = useState<CardSearchRarity[]>(() =>
    parseRarity(rarityParam),
  );

  const [rows, setRows] = useState<CardSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(pageParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    setDraftQ(qParam);
    setDraftScryfall(scryfallParam);
    setDraftLegalIn(parseLegalIn(legalInParam));
    setDraftColorIdentity(parseColorIdentity(colorIdentityParam));
    setDraftTypeContains(parseTypeContains(typeContainsParam));
    setDraftRarity(parseRarity(rarityParam));
  }, [qParam, scryfallParam, legalInParam, colorIdentityParam, typeContainsParam, rarityParam]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        const colorIdentity = parseColorIdentity(colorIdentityParam);
        const legalIn = parseLegalIn(legalInParam);
        const typeContains = parseTypeContains(typeContainsParam);
        const rarity = parseRarity(rarityParam);
        const result = await searchCards(
          getToken,
          {
            q: qParam || undefined,
            scryfall: scryfallParam || undefined,
            legalIn: legalIn.length > 0 ? legalIn : undefined,
            colorIdentity: colorIdentity.length > 0 ? colorIdentity : undefined,
            // Colored pips without C exclude empty identity; C opts colorless back in.
            includeColorless: colorIdentity.length === 0 ? undefined : colorIdentity.includes('C'),
            typeContains: typeContains.length > 0 ? typeContains : undefined,
            rarity: rarity.length > 0 ? rarity : undefined,
            sort: sortParam,
            dir: dirParam,
            limit: PAGE_SIZE,
            page: pageParam,
          },
          { signal },
        );
        if (signal?.aborted) return;
        setRows(result.cards);
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
        applyAdminLoadError(err, { setError, setForbidden }, 'Could not load cards');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [
      getToken,
      qParam,
      scryfallParam,
      legalInParam,
      colorIdentityParam,
      typeContainsParam,
      rarityParam,
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
    const scryfall = draftScryfall.trim();
    if (scryfall) next.set('scryfall', scryfall);
    if (draftLegalIn.length > 0) {
      next.set('legalIn', DECK_FORMATS.filter((format) => draftLegalIn.includes(format)).join(','));
    }
    if (draftColorIdentity.length > 0) {
      next.set(
        'colorIdentity',
        CARD_SEARCH_COLOR_FILTERS.filter((pip) => draftColorIdentity.includes(pip)).join(','),
      );
    }
    if (draftTypeContains.length > 0) {
      next.set(
        'typeContains',
        draftTypeContains
          .map((token) => token.trim())
          .filter(Boolean)
          .join(','),
      );
    }
    if (draftRarity.length > 0) {
      next.set(
        'rarity',
        CARD_SEARCH_RARITIES.filter((rarity) => draftRarity.includes(rarity)).join(','),
      );
    }
    writeSortParams(next, sortParam, dirParam);
    setSearchParams(next);
  };

  const setSort = (sort: CardSearchSort) => {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    const nextDir =
      sort === sortParam ? (dirParam === 'asc' ? 'desc' : 'asc') : defaultCardSortDir(sort);
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
        <h1 className="font-heading text-xl font-semibold">Cards</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Read-only catalog browse. Cards are ingested by ETL syncs — edit goodstuff under
          Recommendations.
        </p>
      </header>

      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="mb-5 grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2 lg:grid-cols-3"
        onSubmit={applyFilters}
      >
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name contains</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            placeholder="Name contains…"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2 lg:col-span-2">
          <span className="text-muted-foreground">
            Scryfall query{' '}
            <a
              href="https://scryfall.com/docs/syntax"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline-offset-2 hover:underline"
            >
              syntax
            </a>
          </span>
          <input
            className="rounded-md border bg-background px-3 py-2 font-mono text-[0.9em]"
            value={draftScryfall}
            onChange={(event) => setDraftScryfall(event.target.value)}
            placeholder="t:creature c:g mv<=3"
            spellCheck={false}
          />
        </label>
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Legal in</span>
          <LegalInFilter value={draftLegalIn} onChange={setDraftLegalIn} />
        </div>
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Color identity</span>
          <ColorIdentityFilter value={draftColorIdentity} onChange={setDraftColorIdentity} />
        </div>
        <TypeContainsField value={draftTypeContains} onChange={setDraftTypeContains} />
        <div className="grid gap-1 text-sm lg:col-span-2">
          <span className="text-muted-foreground">Rarity</span>
          <RarityFilter value={draftRarity} onChange={setDraftRarity} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={loading}>
            Apply
          </Button>
        </div>
      </form>

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {loading ? 'Loading…' : `${total.toLocaleString()} cards`}
      </p>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table className="min-w-4xl">
          <TableHeader>
            <TableRow>
              <TableHead className={`w-16 min-w-16 ${cellPad}`} />
              <SortableHead
                active={sortParam === 'name'}
                dir={sortParam === 'name' ? dirParam : undefined}
                onClick={() => setSort('name')}
                className={cellPad}
              >
                Name
              </SortableHead>
              <TableHead className={cellPad}>Type</TableHead>
              <SortableHead
                active={sortParam === 'manaValue'}
                dir={sortParam === 'manaValue' ? dirParam : undefined}
                onClick={() => setSort('manaValue')}
                className={cellPad}
              >
                Mana
              </SortableHead>
              <TableHead className={cellPad}>Rarity</TableHead>
              <TableHead className={cellPad}>Legal</TableHead>
              <TableHead className={cellPad}>Flags</TableHead>
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
                  className={`w-16 min-w-16 ${cellPad}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <CardThumb src={card.imageNormal} alt="" />
                </TableCell>
                <TableCell className={`min-w-44 font-medium ${cellPad}`}>
                  <Link
                    to={`/catalog/cards/${card.id}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {card.name}
                  </Link>
                </TableCell>
                <TableCell
                  className={`min-w-52 max-w-72 truncate text-muted-foreground ${cellPad}`}
                >
                  {card.typeLine ?? '—'}
                </TableCell>
                <TableCell className={`min-w-28 ${cellPad}`}>
                  {card.manaCost ? <ManaCost cost={card.manaCost} size={14} /> : '—'}
                </TableCell>
                <TableCell className={`min-w-28 text-muted-foreground ${cellPad}`}>
                  {formatRarity(card.rarity)}
                </TableCell>
                <TableCell className={`min-w-28 text-muted-foreground ${cellPad}`}>
                  {formatLegalities(card)}
                </TableCell>
                <TableCell className={`min-w-36 ${cellPad}`}>
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
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={`text-muted-foreground ${cellPad}`}>
                  No cards match these filters.
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

const writeSortParams = (params: URLSearchParams, sort: CardSearchSort, dir: SortDir) => {
  if (sort === CARD_SEARCH_DEFAULT_SORT) params.delete('sort');
  else params.set('sort', sort);
  if (dir === defaultCardSortDir(sort)) params.delete('dir');
  else params.set('dir', dir);
};
