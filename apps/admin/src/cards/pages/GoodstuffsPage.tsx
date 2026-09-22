import { useEffect, useState } from 'react';

import type { CardNameSuggestion, GoodstuffTag, RecommendationGoodstuff } from '@respark/schemas';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@respark/ui/lib';

import {
  CARD_SUGGESTION_DEBOUNCE_MS,
  CARD_SUGGESTION_MIN_CHARS,
  GOODSTUFF_TAGS,
} from '@respark-admin/cards/constants';
import {
  useCardSuggestions,
  useCreateGoodstuff,
  useDeleteGoodstuff,
  useGoodstuffs,
} from '@respark-admin/cards/hooks';
import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import { apiErrorMessage } from '@respark-admin/core/lib';
export const GoodstuffsPage = () => {
  const { data: rows = [], isPending, error } = useGoodstuffs();
  const createMutation = useCreateGoodstuff();
  const deleteMutation = useDeleteGoodstuff();

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selected, setSelected] = useState<CardNameSuggestion | null>(null);
  const [tags, setTags] = useState<GoodstuffTag[]>(['interaction']);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), CARD_SUGGESTION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const suggestionsQuery = useCardSuggestions(
    debouncedQ,
    !selected && debouncedQ.length >= CARD_SUGGESTION_MIN_CHARS,
  );
  const suggestions = suggestionsQuery.data ?? [];

  const saving = createMutation.isPending || deleteMutation.isPending;

  const toggleTag = (tag: GoodstuffTag) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
  };

  const onAdd = async () => {
    if (!selected || tags.length === 0) return;
    setStatus(null);
    setActionError(null);
    try {
      await createMutation.mutateAsync({
        cardId: selected.id,
        tags,
        note: note.trim() || null,
      });
      setStatus(`Added ${selected.name}`);
      setSelected(null);
      setQ('');
      setNote('');
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not add goodstuff'));
    }
  };

  const onRemove = async (row: RecommendationGoodstuff) => {
    setStatus(null);
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(row.cardId);
      setStatus(`Removed ${row.name}`);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not remove goodstuff'));
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <header className="mb-4">
        <h1 className="font-heading text-xl font-semibold">Goodstuff</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Generically strong cards that often win EDHREC % without implying a deck theme. Soft flag
          for chat: they still appear in search; the model should skip them unless the player asked
          for that class or the list already plays that pattern.
        </p>
      </header>

      {status ? (
        <p className="mb-3 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}

      <AdminLoadErrorAlert error={error} fallback="Could not load goodstuff" />
      {actionError ? (
        <Alert className="mb-3">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="mb-5 grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        onSubmit={(event) => {
          event.preventDefault();
          void onAdd();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="relative block text-sm">
            <span className="mb-1 block text-muted-foreground">Card</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selected ? selected.name : q}
              onChange={(event) => {
                setSelected(null);
                setQ(event.target.value);
              }}
              placeholder="Search catalog…"
              autoComplete="off"
            />
            {suggestions.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-card shadow">
                {suggestions.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setSelected(hit);
                        setQ(hit.name);
                      }}
                    >
                      {hit.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Note</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={!selected || tags.length === 0 || saving}>
              Add
            </Button>
          </div>
        </div>
        <fieldset className="block text-sm">
          <legend className="mb-2 text-muted-foreground">Tags</legend>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-md border bg-background p-2">
            {GOODSTUFF_TAGS.map((tag) => {
              const checked = tags.includes(tag);
              return (
                <label
                  key={tag}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTag(tag)}
                    className="accent-primary"
                  />
                  {tag}
                </label>
              );
            })}
          </div>
        </fieldset>
      </form>

      {isPending ? <p className="text-muted-foreground">Loading…</p> : null}

      {!isPending && !error && rows.length === 0 ? (
        <p className="text-muted-foreground">No goodstuff yet. Add one.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.cardId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.note ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={saving}
                      onClick={() => void onRemove(row)}
                    >
                      Remove
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
