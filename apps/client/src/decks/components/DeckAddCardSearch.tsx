import { useEffect, useState } from 'react';

import { Input } from '@respark/ui/lib';

import {
  CARD_SUGGESTION_DEBOUNCE_MS,
  CARD_SUGGESTION_MIN_CHARS,
  useCardSuggestions,
  type CardNameSuggestion,
} from '@respark-client/cards';

import type { ColorIdentityPip, DeckFormat } from '../types';

type Props = {
  format: DeckFormat;
  colorIdentity?: ColorIdentityPip[];
  onAdd: (suggestion: CardNameSuggestion) => Promise<boolean>;
};

export const DeckAddCardSearch = ({ format, colorIdentity, onAdd }: Props) => {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(query.trim()), CARD_SUGGESTION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const suggestionsQuery = useCardSuggestions(debouncedQ, {
    legalIn: format,
    colorIdentity: format === 'commander' ? colorIdentity : undefined,
  });
  const suggestions = suggestionsQuery.data ?? [];
  const suggesting = suggestionsQuery.isFetching;

  const handleAdd = async (suggestion: CardNameSuggestion) => {
    if (addingId) return;
    setAddingId(suggestion.id);
    try {
      const added = await onAdd(suggestion);
      if (added) {
        setQuery('');
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
      {!suggesting && debouncedQ.length >= CARD_SUGGESTION_MIN_CHARS && suggestions.length === 0 ? (
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
