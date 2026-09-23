import { LucideX } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { CardNameSuggestion, GoodstuffTag, RecommendationGoodstuff } from '@respark/schemas';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
  usePatchGoodstuff,
} from '@respark-admin/cards/hooks';
import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import { apiErrorMessage } from '@respark-admin/core/lib';

type DialogMode = 'create' | 'edit';

const DEFAULT_TAGS: GoodstuffTag[] = [];

export const GoodstuffsPage = () => {
  const { data: rows = [], isPending, error } = useGoodstuffs();
  const createMutation = useCreateGoodstuff();
  const patchMutation = usePatchGoodstuff();
  const deleteMutation = useDeleteGoodstuff();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>('create');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selected, setSelected] = useState<CardNameSuggestion | null>(null);
  const [tags, setTags] = useState<GoodstuffTag[]>(DEFAULT_TAGS);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), CARD_SUGGESTION_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const suggestionsQuery = useCardSuggestions(
    debouncedQ,
    dialogOpen && mode === 'create' && !selected && debouncedQ.length >= CARD_SUGGESTION_MIN_CHARS,
  );
  const suggestions = suggestionsQuery.data ?? [];

  const formBusy = createMutation.isPending || patchMutation.isPending;
  const saving = formBusy || deleteMutation.isPending;

  const resetForm = () => {
    setMode('create');
    setEditingCardId(null);
    setEditingName('');
    setSelected(null);
    setQ('');
    setDebouncedQ('');
    setTags(DEFAULT_TAGS);
    setNote('');
    setFormError(null);
  };

  const openDialog = (open: boolean) => {
    if (open) {
      resetForm();
      setDialogOpen(true);
      return;
    }
    if (formBusy) return;
    setDialogOpen(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
    setDialogOpen(true);
  };

  const openEdit = (row: RecommendationGoodstuff) => {
    setMode('edit');
    setEditingCardId(row.cardId);
    setEditingName(row.name);
    setSelected(null);
    setQ('');
    setDebouncedQ('');
    setTags([...row.tags]);
    setNote(row.note ?? '');
    setFormError(null);
    setDialogOpen(true);
  };

  const toggleTag = (tag: GoodstuffTag) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
  };

  const onSubmit = async () => {
    if (tags.length === 0) return;
    setStatus(null);
    setActionError(null);
    setFormError(null);

    if (mode === 'create') {
      if (!selected) return;
      try {
        await createMutation.mutateAsync({
          cardId: selected.id,
          tags,
          note: note.trim() || null,
        });
        setStatus(`Added ${selected.name}`);
        setDialogOpen(false);
        resetForm();
      } catch (err) {
        setFormError(apiErrorMessage(err, 'Could not add goodstuff'));
      }
      return;
    }

    if (!editingCardId) return;
    try {
      await patchMutation.mutateAsync({
        cardId: editingCardId,
        body: {
          tags,
          note: note.trim() || null,
        },
      });
      setStatus(`Updated ${editingName}`);
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not update goodstuff'));
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

  const canSubmit = tags.length > 0 && !formBusy && (mode === 'edit' || selected !== null);

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-5 py-5">
      <header className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold">Goodstuff</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Generically strong cards that often win EDHREC % without implying a deck theme. Soft
            flag for chat: they still appear in search; the model should skip them unless the player
            asked for that class or the list already plays that pattern.
          </p>
        </div>
        <Button type="button" className="shrink-0" onClick={openCreate}>
          Add card
        </Button>
      </header>

      {status ? (
        <p className="mb-3 shrink-0 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}

      <div className="shrink-0">
        <AdminLoadErrorAlert error={error} fallback="Could not load goodstuff" />
        {actionError ? (
          <Alert className="mb-3">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      {isPending ? <p className="shrink-0 text-muted-foreground">Loading…</p> : null}

      {!isPending && !error && rows.length === 0 ? (
        <p className="shrink-0 text-muted-foreground">No goodstuff yet. Add one.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table containerClassName="min-h-0 flex-1 overflow-auto">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_0_var(--border)]">
              <TableRow className="hover:bg-transparent">
                <TableHead>Card</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-40" />
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
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={saving}
                        onClick={() => void onRemove(row)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={openDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(90vh,40rem)] w-[min(calc(100%-2rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
            <div className="min-w-0 space-y-1">
              <DialogTitle>{mode === 'create' ? 'Add goodstuff' : 'Edit goodstuff'}</DialogTitle>
              <DialogDescription>
                {mode === 'create'
                  ? 'Pick a catalog card, tags, and an optional note.'
                  : 'Update tags and note for this card.'}
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={formBusy}
                  aria-label="Close"
                />
              }
            >
              <LucideX />
            </DialogClose>
          </div>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
              {mode === 'create' ? (
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
                    disabled={formBusy}
                    autoFocus
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
              ) : (
                <div className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Card</span>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 font-medium">
                    {editingName}
                  </p>
                </div>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Note</span>
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional"
                  disabled={formBusy}
                />
              </label>
              <fieldset className="block text-sm">
                <legend className="mb-2 text-muted-foreground">Tags</legend>
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border bg-background p-2">
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
                          disabled={formBusy}
                        />
                        {tag}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <DialogClose render={<Button type="button" variant="outline" disabled={formBusy} />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={!canSubmit}>
                {formBusy
                  ? mode === 'create'
                    ? 'Adding…'
                    : 'Saving…'
                  : mode === 'create'
                    ? 'Add'
                    : 'Save'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
};
