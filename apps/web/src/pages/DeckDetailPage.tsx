import { useAuth } from '@clerk/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BoardSection, CardPreview } from '../components/DeckBoard.tsx';
import { DeckImportDialog } from '../components/DeckImportDialog.tsx';
import { PrintingPickerDialog } from '../components/PrintingPickerDialog.tsx';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { uuidSchema } from 'schemas/primitives';
import { ApiError, isNotFound } from '../lib/api.ts';
import { NotFoundPage } from './NotFoundPage.tsx';
import { suggestCardNames, type CardNameSuggestion } from '../lib/cards.ts';
import {
  DECK_GROUP_LABELS,
  DECK_GROUP_MODES,
  DECK_SORT_LABELS,
  DECK_SORT_MODES,
  DECK_VIEW_LABELS,
  DECK_VIEW_MODES,
  groupDeckCards,
  type DeckGroupMode,
  type DeckSortMode,
  type DeckViewMode,
} from '../lib/deck-grouping.ts';
import {
  addCardToDeck,
  DECK_FORMAT_LABELS,
  DECK_FORMATS,
  deleteDeck,
  fetchDeck,
  removeDeckCard,
  setDeckCardPrinting,
  setDeckCardQuantity,
  setDeckCardFoil,
  setDeckCardSideboard,
  updateDeck,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
} from '../lib/decks.ts';

const SUGGEST_DEBOUNCE_MS = 200;

const SELECT_CLASS =
  'border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export const DeckDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DeckViewMode>('list');
  const [groupMode, setGroupMode] = useState<DeckGroupMode>('type');
  const [sortMode, setSortMode] = useState<DeckSortMode>('name');
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [pickingCard, setPickingCard] = useState<DeckCard | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [formatDraft, setFormatDraft] = useState<DeckFormat>('standard');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CardNameSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const mainboardCards = useMemo(
    () => detail?.cards.filter((card) => !card.sideboard) ?? [],
    [detail],
  );
  const sideboardCards = useMemo(
    () => detail?.cards.filter((card) => card.sideboard) ?? [],
    [detail],
  );
  const mainGroups = useMemo(
    () => groupDeckCards(mainboardCards, groupMode, sortMode),
    [mainboardCards, groupMode, sortMode],
  );
  const sideGroups = useMemo(
    () => groupDeckCards(sideboardCards, groupMode, sortMode),
    [sideboardCards, groupMode, sortMode],
  );
  const previewableCards = useMemo(
    () => [...mainGroups, ...sideGroups].flatMap((group) => group.cards),
    [mainGroups, sideGroups],
  );
  const previewCard =
    previewableCards.find((card) => card.id === previewCardId) ?? previewableCards[0] ?? null;

  useEffect(() => {
    if (previewableCards.length === 0) {
      setPreviewCardId(null);
      return;
    }
    setPreviewCardId((current) =>
      current && previewableCards.some((card) => card.id === current)
        ? current
        : (previewableCards[0]?.id ?? null),
    );
  }, [previewableCards]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      if (!uuidSchema.safeParse(id).success) {
        setNotFound(true);
        setDetail(null);
        setLoading(false);
        return;
      }
      try {
        const next = await fetchDeck(getToken, id);
        if (!controller.signal.aborted) setDetail(next);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (isNotFound(err)) {
          setNotFound(true);
          setDetail(null);
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load deck');
        setDetail(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (id) void load();
    return () => controller.abort();
  }, [getToken, id]);

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
      void suggestCardNames(getToken, trimmed)
        .then((rows) => {
          if (!controller.signal.aborted) setSuggestions(rows);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggesting(false);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [getToken, query]);

  const handleAdd = async (suggestion: CardNameSuggestion) => {
    if (!detail || addingId) return;
    setAddingId(suggestion.id);
    setActionError(null);
    try {
      const card = await addCardToDeck(getToken, detail.deck.id, suggestion.id);
      setDetail((prev) => (prev ? upsertDeckCard(prev, card.id, card) : prev));
      setPreviewCardId(card.id);
      setQuery('');
      setSuggestions([]);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add card');
    } finally {
      setAddingId(null);
    }
  };

  const bumpQuantity = async (card: DeckCard, delta: number) => {
    if (!detail) return;
    const nextQty = card.quantity + delta;
    setActionError(null);
    try {
      if (nextQty <= 0) {
        await removeDeckCard(getToken, detail.deck.id, card.id);
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                cards: prev.cards.filter((c) => c.id !== card.id),
              }
            : prev,
        );
        return;
      }
      const updated = await setDeckCardQuantity(getToken, detail.deck.id, card.id, nextQty);
      if (!updated) return;
      setDetail((prev) => (prev ? upsertDeckCard(prev, card.id, updated) : prev));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update quantity');
    }
  };

  const handlePrintingSelect = async (printingId: string) => {
    if (!detail || !pickingCard) return;
    const previousId = pickingCard.id;
    const updated = await setDeckCardPrinting(getToken, detail.deck.id, previousId, printingId);
    setDetail((prev) => (prev ? upsertDeckCard(prev, previousId, updated) : prev));
  };

  const toggleFoil = async (card: DeckCard) => {
    if (!detail) return;
    setActionError(null);
    try {
      const updated = await setDeckCardFoil(getToken, detail.deck.id, card.id, !card.foil);
      setDetail((prev) => (prev ? upsertDeckCard(prev, card.id, updated) : prev));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update foil');
    }
  };

  const toggleSideboard = async (card: DeckCard) => {
    if (!detail) return;
    setActionError(null);
    try {
      const updated = await setDeckCardSideboard(
        getToken,
        detail.deck.id,
        card.id,
        !card.sideboard,
      );
      setDetail((prev) => (prev ? upsertDeckCard(prev, card.id, updated) : prev));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not move card');
    }
  };

  const startEditDetails = () => {
    if (!detail) return;
    setNameDraft(detail.deck.name);
    setFormatDraft(detail.deck.format);
    setDescriptionDraft(detail.deck.description ?? '');
    setEditingDetails(true);
    setActionError(null);
  };

  const cancelEditDetails = () => {
    setEditingDetails(false);
    setNameDraft('');
    setDescriptionDraft('');
  };

  const saveDetails = async () => {
    if (!detail || savingDetails) return;
    const trimmedName = nameDraft.trim();
    if (!trimmedName) {
      setActionError('Name is required');
      return;
    }

    setSavingDetails(true);
    setActionError(null);
    try {
      const trimmedDescription = descriptionDraft.trim();
      const deck = await updateDeck(getToken, detail.deck.id, {
        name: trimmedName,
        format: formatDraft,
        description: trimmedDescription || null,
      });
      setDetail((prev) => (prev ? { ...prev, deck } : prev));
      setEditingDetails(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save deck details');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!detail || deleting) return;
    const confirmed = window.confirm(`Delete "${detail.deck.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    setActionError(null);
    try {
      await deleteDeck(getToken, detail.deck.id);
      navigate('/home');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not delete deck');
      setDeleting(false);
    }
  };

  const mainTotal = mainboardCards.reduce((sum, card) => sum + card.quantity, 0);
  const sideTotal = sideboardCards.reduce((sum, card) => sum + card.quantity, 0);

  if (notFound) {
    return (
      <NotFoundPage
        title="Deck not found"
        description="That deck is not in your library, or the link is stale."
      />
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8 text-left">
        <div>
          <Button variant="outline" size="sm" render={<Link to="/home" />}>
            Back to decks
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground" aria-live="polite">
            Loading deck…
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && detail ? (
          <>
            <header className="space-y-2">
              {editingDetails ? (
                <div className="max-w-2xl space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="deck-name">Name</Label>
                    <Input
                      id="deck-name"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      maxLength={120}
                      required
                      disabled={savingDetails}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deck-format">Format</Label>
                    <select
                      id="deck-format"
                      value={formatDraft}
                      onChange={(event) => setFormatDraft(event.target.value as DeckFormat)}
                      disabled={savingDetails}
                      className={`${SELECT_CLASS} w-full`}
                    >
                      {DECK_FORMATS.map((value) => (
                        <option key={value} value={value}>
                          {DECK_FORMAT_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deck-description">Description</Label>
                    <textarea
                      id="deck-description"
                      value={descriptionDraft}
                      onChange={(event) => setDescriptionDraft(event.target.value)}
                      placeholder="Optional notes about the deck…"
                      maxLength={2000}
                      rows={3}
                      disabled={savingDetails}
                      className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingDetails}
                      onClick={cancelEditDetails}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingDetails || !nameDraft.trim()}
                      onClick={() => void saveDetails()}
                    >
                      {savingDetails ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <h1 className="font-heading text-3xl tracking-tight">{detail.deck.name}</h1>
                      <p className="text-sm text-muted-foreground">
                        {DECK_FORMAT_LABELS[detail.deck.format]} · {mainTotal} card
                        {mainTotal === 1 ? '' : 's'}
                        {sideTotal > 0 ? ` · ${sideTotal} sideboard` : ''} · {mainboardCards.length}{' '}
                        unique
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setImportOpen(true)}
                      >
                        Import
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={startEditDetails}>
                        Edit details
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deleting}
                        onClick={() => void handleDelete()}
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                  {detail.deck.description ? (
                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {detail.deck.description}
                    </p>
                  ) : null}
                </>
              )}
            </header>

            {actionError ? (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}

            <section className="space-y-4" aria-labelledby="deck-list-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="deck-list-heading" className="font-heading text-xl">
                  Deck list
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-3">
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
                  {detail.cards.length > 0 ? (
                    <>
                      <ToolbarSelect<DeckViewMode>
                        id="deck-view"
                        label="View"
                        value={viewMode}
                        options={DECK_VIEW_MODES.map((mode) => ({
                          value: mode,
                          label: DECK_VIEW_LABELS[mode],
                        }))}
                        onChange={setViewMode}
                      />
                      <ToolbarSelect<DeckGroupMode>
                        id="deck-group"
                        label="Group"
                        value={groupMode}
                        options={DECK_GROUP_MODES.map((mode) => ({
                          value: mode,
                          label: DECK_GROUP_LABELS[mode],
                        }))}
                        onChange={setGroupMode}
                      />
                      <ToolbarSelect<DeckSortMode>
                        id="deck-sort"
                        label="Sort"
                        value={sortMode}
                        options={DECK_SORT_MODES.map((mode) => ({
                          value: mode,
                          label: DECK_SORT_LABELS[mode],
                        }))}
                        onChange={setSortMode}
                      />
                    </>
                  ) : null}
                </div>
              </div>

              {detail.cards.length === 0 ? (
                <p className="text-muted-foreground">
                  No cards yet — search by name above to add some.
                </p>
              ) : (
                <div className="flex flex-col items-start gap-6 lg:flex-row">
                  <CardPreview card={previewCard} />
                  <div className="min-w-0 flex-1 space-y-8">
                    {mainboardCards.length > 0 ? (
                      <BoardSection
                        title="Mainboard"
                        showTitle={sideboardCards.length > 0}
                        groups={mainGroups}
                        viewMode={viewMode}
                        previewCardId={previewCard?.id ?? null}
                        onPreview={setPreviewCardId}
                        onPickPrinting={setPickingCard}
                        onBump={bumpQuantity}
                        onToggleFoil={toggleFoil}
                        onToggleSideboard={toggleSideboard}
                      />
                    ) : null}
                    {sideboardCards.length > 0 ? (
                      <BoardSection
                        title="Sideboard"
                        showTitle
                        groups={sideGroups}
                        viewMode={viewMode}
                        previewCardId={previewCard?.id ?? null}
                        onPreview={setPreviewCardId}
                        onPickPrinting={setPickingCard}
                        onBump={bumpQuantity}
                        onToggleFoil={toggleFoil}
                        onToggleSideboard={toggleSideboard}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            <PrintingPickerDialog
              open={pickingCard !== null}
              onOpenChange={(open) => {
                if (!open) setPickingCard(null);
              }}
              deckCard={pickingCard}
              onSelect={handlePrintingSelect}
            />
            <DeckImportDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              deckId={detail.deck.id}
              onImported={(next) => setDetail(next)}
            />
          </>
        ) : null}
      </main>
    </>
  );
};

const ToolbarSelect = <T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex items-center gap-2">
    <Label htmlFor={id} className="text-xs text-muted-foreground">
      {label}
    </Label>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={SELECT_CLASS}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const upsertDeckCard = (detail: DeckDetail, previousId: string, next: DeckCard): DeckDetail => {
  const without = detail.cards.filter((card) => card.id !== previousId && card.id !== next.id);
  const cards = [...without, next].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.setCode.localeCompare(b.setCode);
  });
  return {
    deck: { ...detail.deck, updatedAt: new Date().toISOString() },
    cards,
  };
};
