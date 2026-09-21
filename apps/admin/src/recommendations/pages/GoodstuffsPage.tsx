import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useState } from 'react';
import {
  goodstuffTagSchema,
  type GoodstuffTag,
  type RecommendationGoodstuff,
} from 'schemas/recommendations';
import type { CardNameSuggestion } from 'schemas/cards';
import { Alert, AlertDescription } from '@/core/ui/alert';
import { Badge } from '@/core/ui/badge';
import { Button } from '@/core/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/ui/table';
import { applyAdminLoadError, apiErrorMessage } from '@/core';
import {
  createGoodstuff,
  deleteGoodstuff,
  fetchGoodstuffs,
  suggestCards,
} from '../lib/goodstuffs.ts';

const TAGS = goodstuffTagSchema.options;

export const GoodstuffsPage = () => {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<RecommendationGoodstuff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<CardNameSuggestion[]>([]);
  const [selected, setSelected] = useState<CardNameSuggestion | null>(null);
  const [tags, setTags] = useState<GoodstuffTag[]>(['interaction']);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setForbidden(false);
      try {
        const list = await fetchGoodstuffs(getToken);
        if (!signal?.aborted) setRows(list);
      } catch (err) {
        if (signal?.aborted) return;
        applyAdminLoadError(err, { setError, setForbidden }, 'Could not load goodstuff');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2 || selected) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void suggestCards(getToken, query)
        .then((hits) => {
          if (!controller.signal.aborted) setSuggestions(hits);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [getToken, q, selected]);

  const toggleTag = (tag: GoodstuffTag) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
  };

  const onAdd = async () => {
    if (!selected || tags.length === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      await createGoodstuff(getToken, {
        cardId: selected.id,
        tags,
        note: note.trim() || null,
      });
      setSelected(null);
      setQ('');
      setNote('');
      setStatus(`Added ${selected.name}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add goodstuff'));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (row: RecommendationGoodstuff) => {
    setSaving(true);
    setStatus(null);
    try {
      await deleteGoodstuff(getToken, row.cardId);
      setStatus(`Removed ${row.name}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove goodstuff'));
    } finally {
      setSaving(false);
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

      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
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
                        setSuggestions([]);
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
            {TAGS.map((tag) => {
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

      {loading ? <p className="text-muted-foreground">Loading…</p> : null}

      {!loading && !error && rows.length === 0 ? (
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
