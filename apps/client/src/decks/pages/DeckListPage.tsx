import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@respark/ui/lib';

import { ColorIdentity } from '@respark-client/cards';
import { useChatSession } from '@respark-client/chat';
import { ApiError } from '@respark-client/core';

import { DECK_FORMAT_LABELS } from '../constants';
import { useDecks, useDeleteDeck } from '../hooks';
import { formatRelativeTime } from '../lib/format';
import type { Deck } from '../types';

type SortKey = 'name' | 'colors' | 'format' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const sortDecks = (decks: Deck[], key: SortKey, dir: SortDir): Deck[] => {
  const sign = dir === 'asc' ? 1 : -1;
  return [...decks].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = a.name.localeCompare(b.name);
    else if (key === 'colors') {
      cmp = a.colorIdentity.join('').localeCompare(b.colorIdentity.join(''));
    } else if (key === 'format') {
      cmp = DECK_FORMAT_LABELS[a.format].localeCompare(DECK_FORMAT_LABELS[b.format]);
    } else {
      cmp = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    }
    return sign * cmp;
  });
};

const SortHeader = ({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) => {
  const active = sortKey === column;
  return (
    <TableHead aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        onClick={() => onSort(column)}
      >
        {label}
        {active ? <span aria-hidden>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
      </button>
    </TableHead>
  );
};

export const DeckListPage = () => {
  const navigate = useNavigate();
  const { deckId: stickyDeckId, setDeck } = useChatSession();
  const { data: decks = [], isPending: loading, error: queryError } = useDecks();
  const deleteMutation = useDeleteDeck();

  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError
        ? 'Could not load decks'
        : null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'updatedAt' ? 'desc' : 'asc');
  };

  const removeDeck = async (deck: Deck) => {
    if (deleteMutation.isPending) return;
    const confirmed = window.confirm(`Delete "${deck.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(deck.id);
      if (stickyDeckId === deck.id) setDeck(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete deck');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? decks.filter((deck) => deck.name.toLowerCase().includes(q)) : decks;
    return sortDecks(matched, sortKey, sortDir);
  }, [decks, query, sortKey, sortDir]);

  const deletingId = deleteMutation.isPending ? deleteMutation.variables : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-8 text-left">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Your decks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : `Showing ${filtered.length} of ${decks.length} ${decks.length === 1 ? 'result' : 'results'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button render={<Link to="/decks/new" />}>New deck</Button>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search decks…"
            aria-label="Search decks"
            className="w-56"
          />
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && decks.length === 0 ? (
        <p className="text-muted-foreground">No decks yet — create your first one.</p>
      ) : null}

      {!loading && !error && decks.length > 0 && filtered.length === 0 ? (
        <p className="text-muted-foreground">No decks match that search.</p>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader
                  label="Name"
                  column="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Colors"
                  column="colors"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Format"
                  column="format"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHeader
                  label="Updated"
                  column="updatedAt"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deck) => (
                <TableRow
                  key={deck.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="link"
                  onClick={() => navigate(`/decks/${deck.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/decks/${deck.id}`);
                    }
                  }}
                >
                  <TableCell>
                    <span className="font-medium">{deck.name}</span>
                  </TableCell>
                  <TableCell>
                    <ColorIdentity colors={deck.colorIdentity} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {DECK_FORMAT_LABELS[deck.format]}
                  </TableCell>
                  <TableCell>
                    <time className="text-muted-foreground" dateTime={deck.updatedAt}>
                      {formatRelativeTime(deck.updatedAt)}
                    </time>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deletingId !== null}
                      aria-label={`Delete ${deck.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeDeck(deck);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {deletingId === deck.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </main>
  );
};
