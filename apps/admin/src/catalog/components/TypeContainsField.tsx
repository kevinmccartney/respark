import { useAuth } from '@clerk/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CARD_SEARCH_TYPE_CONTAINS_MAX } from 'schemas/cards';
import { suggestCardTypes } from '../lib/cards.ts';

type TypeContainsFieldProps = {
  value: string[];
  onChange: (tokens: string[]) => void;
};

const normalizeToken = (token: string) => token.trim();

const hasToken = (tokens: string[], candidate: string) =>
  tokens.some((token) => token.toLowerCase() === candidate.toLowerCase());

export const TypeContainsField = ({ value, onChange }: TypeContainsFieldProps) => {
  const { getToken } = useAuth();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimer = useRef<number | null>(null);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const atLimit = value.length >= CARD_SEARCH_TYPE_CONTAINS_MAX;

  useEffect(() => {
    const query = draft.trim();
    if (atLimit || query.length < 1) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void suggestCardTypes(getToken, query, { signal: controller.signal })
        .then((hits) => {
          if (controller.signal.aborted) return;
          const filtered = hits.filter((hit) => !hasToken(value, hit));
          setSuggestions(filtered);
          setOpen(filtered.length > 0);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setOpen(false);
          setActiveIndex(-1);
        });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [atLimit, draft, getToken, value]);

  const addToken = (raw: string) => {
    const token = normalizeToken(raw);
    if (!token || atLimit || hasToken(value, token)) {
      setDraft('');
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    onChange([...value, token]);
    setDraft('');
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const removeToken = (token: string) => {
    onChange(value.filter((entry) => entry !== token));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (open && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
        return;
      }
      if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        addToken(suggestions[activeIndex] ?? draft);
        return;
      }
    }

    if (event.key === 'Enter' || event.key === ',') {
      const trimmed = draft.trim();
      if (trimmed.length === 0) return;
      event.preventDefault();
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        addToken(suggestions[activeIndex]);
        return;
      }
      if (open && suggestions.length === 1) {
        addToken(suggestions[0]!);
        return;
      }
      addToken(trimmed);
    }
  };

  return (
    <div className="relative grid gap-1 text-sm">
      <span className="text-muted-foreground">Type contains</span>
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((token) => (
          <span
            key={token}
            className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-0.5 text-sm"
          >
            <span className="truncate">{token}</span>
            <button
              type="button"
              className="rounded px-0.5 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${token}`}
              onClick={(event) => {
                event.stopPropagation();
                removeToken(token);
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/,/g, ''))}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => {
              setOpen(false);
              setActiveIndex(-1);
            }, 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? 'Creature, Elf…' : atLimit ? '' : 'Add type…'}
          disabled={atLimit}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card py-1 shadow-md"
          onMouseDown={(event) => {
            event.preventDefault();
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
          }}
        >
          {suggestions.map((token, index) => (
            <li key={token} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-muted ${
                  index === activeIndex ? 'bg-muted' : ''
                }`}
                onClick={() => addToken(token)}
              >
                {token}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
