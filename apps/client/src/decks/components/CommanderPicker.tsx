import { useEffect, useState } from 'react';

import { isLeadershipCommander } from '@respark/schemas/cards';
import { Button, Input } from '@respark/ui/lib';

import {
  CARD_SUGGESTION_DEBOUNCE_MS,
  CARD_SUGGESTION_MIN_CHARS,
  useCard,
  useCardSuggestions,
  type CardNameSuggestion,
} from '@respark-client/cards';

type Props = {
  printingId: string | null;
  name: string | null;
  disabled?: boolean;
  onChange: (next: { printingId: string; name: string } | null) => void;
};

export const CommanderPicker = ({ printingId, name, disabled, onChange }: Props) => {
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(query.trim()), CARD_SUGGESTION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const suggestionsQuery = useCardSuggestions(
    debouncedQ,
    { legalIn: 'commander', commanderEligible: true },
    !printingId,
  );
  const suggestions = suggestionsQuery.data ?? [];
  const suggesting = suggestionsQuery.isFetching;

  const pickQuery = useCard(pickingId ?? '', Boolean(pickingId));

  useEffect(() => {
    if (!pickingId) return;
    if (pickQuery.isPending) return;
    if (pickQuery.isError) {
      setError('Could not load that commander');
      setPickingId(null);
      return;
    }
    const card = pickQuery.data;
    if (!card) return;

    setPickingId(null);
    if (!isLeadershipCommander(card.leadershipSkills)) {
      setError('That card cannot be a commander');
      return;
    }
    const printing = card.printings[0];
    if (!printing) {
      setError('That card has no printings');
      return;
    }
    onChange({ printingId: printing.id, name: card.name });
    setQuery('');
  }, [onChange, pickQuery.data, pickQuery.isError, pickQuery.isPending, pickingId]);

  const pick = (suggestion: CardNameSuggestion) => {
    if (pickingId) return;
    setError(null);
    setPickingId(suggestion.id);
  };

  if (printingId && name) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span>
          Commander: <span className="font-medium">{name}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for a commander…"
        aria-label="Search for a commander"
        autoComplete="off"
        disabled={disabled}
      />
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
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
                onClick={() => pick(suggestion)}
                disabled={Boolean(pickingId)}
              >
                <span className="font-medium">{suggestion.name}</span>
                <span className="text-muted-foreground">
                  {pickingId === suggestion.id ? 'Selecting…' : 'Select'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
