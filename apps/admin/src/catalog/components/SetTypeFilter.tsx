import { useAuth } from '@clerk/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { SET_SEARCH_SET_TYPE_MAX } from 'schemas/sets';
import { suggestSetTypes } from '../lib/sets.ts';

type SetTypeFilterProps = {
  value: string[];
  onChange: (types: string[]) => void;
};

const hasType = (types: string[], candidate: string) =>
  types.some((entry) => entry.toLowerCase() === candidate.toLowerCase());

export const SetTypeFilter = ({ value, onChange }: SetTypeFilterProps) => {
  const { getToken } = useAuth();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimer = useRef<number | null>(null);
  const focusedRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const atLimit = value.length >= SET_SEARCH_SET_TYPE_MAX;

  useEffect(() => {
    if (atLimit) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void suggestSetTypes(getToken, draft.trim(), { signal: controller.signal })
        .then((hits) => {
          if (controller.signal.aborted) return;
          const filtered = hits.filter((hit) => !hasType(value, hit));
          setSuggestions(filtered);
          // Only show the menu while the field is focused — not on mount.
          setOpen(focusedRef.current && filtered.length > 0);
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

  const addType = (raw: string) => {
    const token = raw.trim();
    if (!token || atLimit || hasType(value, token)) {
      setDraft('');
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    onChange([...value, token]);
    setDraft('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const removeType = (token: string) => {
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

    if (!open || suggestions.length === 0) return;

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
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        addType(suggestions[activeIndex]);
        return;
      }
      if (suggestions.length === 1) {
        addType(suggestions[0]!);
      }
    }
  };

  return (
    <div className="relative grid gap-1 text-sm">
      <span className="text-muted-foreground">Set type</span>
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
                removeType(token);
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
            focusedRef.current = true;
            if (!atLimit && suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            blurTimer.current = window.setTimeout(() => {
              setOpen(false);
              setActiveIndex(-1);
            }, 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? 'expansion, commander…' : atLimit ? '' : 'Add type…'}
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
                onClick={() => addType(token)}
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
