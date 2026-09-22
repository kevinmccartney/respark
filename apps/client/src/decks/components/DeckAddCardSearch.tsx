import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';

import { Input } from '@respark/ui/lib';

import { suggestCardNames, type CardNameSuggestion } from '@/cards';
import { isAbortError } from '@/core';

import type { ColorIdentityPip, DeckFormat } from '../lib/decks';

const SUGGEST_DEBOUNCE_MS = 200;

type Props = {
  format: DeckFormat;
  colorIdentity?: ColorIdentityPip[];
  onAdd: (suggestion: CardNameSuggestion) => Promise<boolean>;
};

export const DeckAddCardSearch = ({ format, colorIdentity, onAdd }: Props) => {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CardNameSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setSuggesting(true);
      void suggestCardNames(
        getToken,
        trimmed,
        { signal: controller.signal },
        { legalIn: format, colorIdentity: format === 'commander' ? colorIdentity : undefined },
      )
        .then((rows) => {
          if (!controller.signal.aborted) setSuggestions(rows);
        })
        .catch((err) => {
          if (isAbortError(err) || controller.signal.aborted) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggesting(false);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [colorIdentity, format, getToken, query]);

  const handleAdd = async (suggestion: CardNameSuggestion) => {
    if (addingId) return;
    setAddingId(suggestion.id);
    try {
      const added = await onAdd(suggestion);
      if (added) {
        setQuery('');
        setSuggestions([]);
      }
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="relative w-72">
      <Input
        id="deck-card-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find and add cards…"
        aria-label="Find and add cards"
        autoComplete="off"
        className="w-full"
      />
      {suggesting ? (
        <p className="absolute top-full z-10 mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
          Searching…
        </p>
      ) : null}
      {!suggesting && query.trim().length >= 2 && suggestions.length === 0 ? (
        <p className="absolute top-full z-10 mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
          No matching names.
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul className="absolute top-full z-10 mt-1 max-h-72 w-full divide-y overflow-auto rounded-md border bg-background shadow-sm">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                onClick={() => void handleAdd(suggestion)}
                disabled={addingId === suggestion.id}
              >
                <span className="font-medium">{suggestion.name}</span>
                <span className="text-muted-foreground">
                  {addingId === suggestion.id ? 'Adding…' : 'Add'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
