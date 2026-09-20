import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isLeadershipCommander } from 'schemas/cards';
import { isAbortError } from '../lib/api.ts';
import { fetchCard, suggestCardNames, type CardNameSuggestion } from '../lib/cards.ts';

const SUGGEST_DEBOUNCE_MS = 200;

type Props = {
  printingId: string | null;
  name: string | null;
  disabled?: boolean;
  onChange: (next: { printingId: string; name: string } | null) => void;
};

export const CommanderPicker = ({ printingId, name, disabled, onChange }: Props) => {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CardNameSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || printingId) {
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
        { legalIn: 'commander', commanderEligible: true },
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
  }, [getToken, printingId, query]);

  const pick = async (suggestion: CardNameSuggestion) => {
    if (pickingId) return;
    setPickingId(suggestion.id);
    setError(null);
    try {
      const card = await fetchCard(getToken, suggestion.id);
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
      setSuggestions([]);
    } catch (err) {
      if (isAbortError(err)) return;
      setError('Could not load that commander');
    } finally {
      setPickingId(null);
    }
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
                onClick={() => void pick(suggestion)}
                disabled={pickingId === suggestion.id}
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
