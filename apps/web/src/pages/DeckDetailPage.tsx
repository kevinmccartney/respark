import { useAuth } from '@clerk/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ManaCost } from '../components/ManaCost.tsx'
import { PrintingPickerDialog } from '../components/PrintingPickerDialog.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { ApiError } from '../lib/api.ts'
import { suggestCardNames, type CardNameSuggestion } from '../lib/cards.ts'
import {
  DECK_GROUP_LABELS,
  DECK_GROUP_MODES,
  groupDeckCards,
  type DeckGroupMode,
} from '../lib/deck-grouping.ts'
import {
  addCardToDeck,
  DECK_FORMAT_LABELS,
  DECK_FORMATS,
  deleteDeck,
  fetchDeck,
  removeDeckCard,
  setDeckCardPrinting,
  setDeckCardQuantity,
  updateDeck,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
} from '../lib/decks.ts'

const SUGGEST_DEBOUNCE_MS = 200

type ViewMode = 'list' | 'grid'

export function DeckDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<DeckDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [groupMode, setGroupMode] = useState<DeckGroupMode>('none')
  const [pickingCard, setPickingCard] = useState<DeckCard | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [formatDraft, setFormatDraft] = useState<DeckFormat>('standard')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CardNameSuggestion[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const groups = useMemo(
    () => (detail ? groupDeckCards(detail.cards, groupMode) : []),
    [detail, groupMode],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const next = await fetchDeck(getToken, id)
        if (!controller.signal.aborted) setDetail(next)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof ApiError ? err.message : 'Could not load deck')
        setDetail(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    if (id) void load()
    return () => controller.abort()
  }, [getToken, id])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setSuggesting(false)
      return
    }

    const controller = new AbortController()
    const handle = window.setTimeout(() => {
      setSuggesting(true)
      void suggestCardNames(getToken, trimmed)
        .then((rows) => {
          if (!controller.signal.aborted) setSuggestions(rows)
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggesting(false)
        })
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(handle)
    }
  }, [getToken, query])

  async function handleAdd(suggestion: CardNameSuggestion) {
    if (!detail || addingId) return
    setAddingId(suggestion.id)
    setActionError(null)
    try {
      const card = await addCardToDeck(getToken, detail.deck.id, suggestion.id)
      setDetail((prev) => (prev ? upsertDeckCard(prev, card.id, card) : prev))
      setQuery('')
      setSuggestions([])
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not add card')
    } finally {
      setAddingId(null)
    }
  }

  async function bumpQuantity(card: DeckCard, delta: number) {
    if (!detail) return
    const nextQty = card.quantity + delta
    setActionError(null)
    try {
      if (nextQty <= 0) {
        await removeDeckCard(getToken, detail.deck.id, card.id)
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                cards: prev.cards.filter((c) => c.id !== card.id),
              }
            : prev,
        )
        return
      }
      const updated = await setDeckCardQuantity(
        getToken,
        detail.deck.id,
        card.id,
        nextQty,
      )
      if (!updated) return
      setDetail((prev) => (prev ? upsertDeckCard(prev, card.id, updated) : prev))
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Could not update quantity',
      )
    }
  }

  async function handlePrintingSelect(printingId: string) {
    if (!detail || !pickingCard) return
    const previousId = pickingCard.id
    const updated = await setDeckCardPrinting(
      getToken,
      detail.deck.id,
      previousId,
      printingId,
    )
    setDetail((prev) => (prev ? upsertDeckCard(prev, previousId, updated) : prev))
  }

  function startEditDetails() {
    if (!detail) return
    setNameDraft(detail.deck.name)
    setFormatDraft(detail.deck.format)
    setDescriptionDraft(detail.deck.description ?? '')
    setEditingDetails(true)
    setActionError(null)
  }

  function cancelEditDetails() {
    setEditingDetails(false)
    setNameDraft('')
    setDescriptionDraft('')
  }

  async function saveDetails() {
    if (!detail || savingDetails) return
    const trimmedName = nameDraft.trim()
    if (!trimmedName) {
      setActionError('Name is required')
      return
    }

    setSavingDetails(true)
    setActionError(null)
    try {
      const trimmedDescription = descriptionDraft.trim()
      const deck = await updateDeck(getToken, detail.deck.id, {
        name: trimmedName,
        format: formatDraft,
        description: trimmedDescription || null,
      })
      setDetail((prev) => (prev ? { ...prev, deck } : prev))
      setEditingDetails(false)
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Could not save deck details',
      )
    } finally {
      setSavingDetails(false)
    }
  }

  async function handleDelete() {
    if (!detail || deleting) return
    const confirmed = window.confirm(
      `Delete “${detail.deck.name}”? This cannot be undone.`,
    )
    if (!confirmed) return

    setDeleting(true)
    setActionError(null)
    try {
      await deleteDeck(getToken, detail.deck.id)
      navigate('/home')
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Could not delete deck',
      )
      setDeleting(false)
    }
  }

  const totalCards =
    detail?.cards.reduce((sum, card) => sum + card.quantity, 0) ?? 0

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 text-left">
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
                      onChange={(event) =>
                        setFormatDraft(event.target.value as DeckFormat)
                      }
                      disabled={savingDetails}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                      <h1 className="font-heading text-3xl tracking-tight">
                        {detail.deck.name}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        {DECK_FORMAT_LABELS[detail.deck.format]} · {totalCards}{' '}
                        card{totalCards === 1 ? '' : 's'} ·{' '}
                        {detail.cards.length} unique
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={startEditDetails}
                      >
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

            <section className="space-y-2" aria-labelledby="add-cards-heading">
              <h2 id="add-cards-heading" className="font-heading text-xl">
                Add cards
              </h2>
              <div className="space-y-1.5">
                <Label htmlFor="deck-card-search">Search by name</Label>
                <Input
                  id="deck-card-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Start typing a card name…"
                  autoComplete="off"
                />
              </div>
              {suggesting ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : null}
              {!suggesting && query.trim().length >= 2 && suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching names.</p>
              ) : null}
              {suggestions.length > 0 ? (
                <ul className="divide-y rounded-md border">
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
            </section>

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
                {detail.cards.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleGroup<DeckGroupMode>
                      label="Group by"
                      value={groupMode}
                      options={DECK_GROUP_MODES.map((mode) => ({
                        value: mode,
                        label: DECK_GROUP_LABELS[mode],
                      }))}
                      onChange={setGroupMode}
                    />
                    <ToggleGroup<ViewMode>
                      label="Layout"
                      value={viewMode}
                      options={[
                        { value: 'list', label: 'List' },
                        { value: 'grid', label: 'Grid' },
                      ]}
                      onChange={setViewMode}
                    />
                  </div>
                ) : null}
              </div>

              {detail.cards.length === 0 ? (
                <p className="text-muted-foreground">
                  No cards yet — search by name above to add some.
                </p>
              ) : (
                <div className="space-y-6">
                  {groups.map((group) => (
                    <div key={group.key} className="space-y-3">
                      {groupMode !== 'none' ? (
                        <h3 className="flex items-baseline justify-between gap-3 border-b pb-1 font-heading text-base">
                          <span>{group.label}</span>
                          <span className="text-sm font-normal text-muted-foreground">
                            {group.totalQuantity}
                          </span>
                        </h3>
                      ) : null}
                      {group.subgroups && group.subgroups.length > 0 ? (
                        <div className="space-y-4">
                          {group.subgroups.map((subgroup) => (
                            <div key={subgroup.key} className="space-y-2">
                              <h4 className="flex items-baseline justify-between gap-3 text-sm font-medium text-muted-foreground">
                                <span>{subgroup.label}</span>
                                <span className="font-normal tabular-nums">
                                  {subgroup.totalQuantity}
                                </span>
                              </h4>
                              <CardCollection
                                cards={subgroup.cards}
                                viewMode={viewMode}
                                onPickPrinting={setPickingCard}
                                onBump={bumpQuantity}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <CardCollection
                          cards={group.cards}
                          viewMode={viewMode}
                          onPickPrinting={setPickingCard}
                          onBump={bumpQuantity}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <PrintingPickerDialog
              open={pickingCard !== null}
              onOpenChange={(open) => {
                if (!open) setPickingCard(null)
              }}
              deckCard={pickingCard}
              onSelect={handlePrintingSelect}
            />
          </>
        ) : null}
      </main>
    </>
  )
}

function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="inline-flex rounded-md border" role="group" aria-label={label}>
        {options.map((option, index) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'secondary' : 'ghost'}
            size="sm"
            className={
              index === 0
                ? 'rounded-r-none'
                : index === options.length - 1
                  ? 'rounded-l-none'
                  : 'rounded-none'
            }
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function CardCollection({
  cards,
  viewMode,
  onPickPrinting,
  onBump,
}: {
  cards: DeckCard[]
  viewMode: ViewMode
  onPickPrinting: (card: DeckCard) => void
  onBump: (card: DeckCard, delta: number) => void
}) {
  if (viewMode === 'list') {
    return (
      <ul className="divide-y rounded-md border">
        {cards.map((card) => (
          <ListCardRow
            key={card.id}
            card={card}
            onPickPrinting={onPickPrinting}
            onBump={onBump}
          />
        ))}
      </ul>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {cards.map((card) => (
        <GridCardCell
          key={card.id}
          card={card}
          onPickPrinting={onPickPrinting}
          onBump={onBump}
        />
      ))}
    </ul>
  )
}

function ListCardRow({
  card,
  onPickPrinting,
  onBump,
}: {
  card: DeckCard
  onPickPrinting: (card: DeckCard) => void
  onBump: (card: DeckCard, delta: number) => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onPickPrinting(card)}
          aria-label={`Change printing for ${card.name}`}
        >
          {card.imageNormal ? (
            <img
              src={card.imageNormal}
              alt=""
              className="h-12 w-auto rounded-sm"
              loading="lazy"
            />
          ) : (
            <div className="bg-muted flex h-12 w-9 items-center justify-center rounded-sm text-[10px]">
              ?
            </div>
          )}
        </button>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              to={`/cards/${card.cardId}`}
              className="font-medium hover:underline"
            >
              {card.name}
            </Link>
            <ManaCost cost={card.manaCost} />
          </div>
          <button
            type="button"
            className="mt-0.5 text-left text-sm text-muted-foreground hover:underline"
            onClick={() => onPickPrinting(card)}
          >
            {card.setCode.toUpperCase()} #{card.collectorNumber}
          </button>
        </div>
      </div>
      <QuantityControls card={card} onBump={onBump} />
    </li>
  )
}

function GridCardCell({
  card,
  onPickPrinting,
  onBump,
}: {
  card: DeckCard
  onPickPrinting: (card: DeckCard) => void
  onBump: (card: DeckCard, delta: number) => void
}) {
  return (
    <li className="flex flex-col gap-2">
      <button
        type="button"
        className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onPickPrinting(card)}
        aria-label={`Change printing for ${card.name}`}
      >
        {card.imageNormal ? (
          <img
            src={card.imageNormal}
            alt={card.name}
            className="w-full rounded-md"
            loading="lazy"
          />
        ) : (
          <div className="bg-muted flex aspect-5/7 items-center justify-center rounded-md px-2 text-center text-sm font-medium">
            {card.name}
          </div>
        )}
      </button>
      <div className="flex flex-col items-center gap-1.5">
        <Link
          to={`/cards/${card.cardId}`}
          className="w-full truncate text-center text-sm font-medium hover:underline"
        >
          {card.name}
        </Link>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => onPickPrinting(card)}
        >
          {card.setCode.toUpperCase()} #{card.collectorNumber}
        </button>
        <QuantityControls card={card} onBump={onBump} />
      </div>
    </li>
  )
}

function upsertDeckCard(
  detail: DeckDetail,
  previousId: string,
  next: DeckCard,
): DeckDetail {
  const without = detail.cards.filter(
    (card) => card.id !== previousId && card.id !== next.id,
  )
  const cards = [...without, next].sort((a, b) => {
    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return a.setCode.localeCompare(b.setCode)
  })
  return {
    deck: { ...detail.deck, updatedAt: new Date().toISOString() },
    cards,
  }
}

function QuantityControls({
  card,
  onBump,
}: {
  card: DeckCard
  onBump: (card: DeckCard, delta: number) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Decrease ${card.name}`}
        onClick={() => void onBump(card, -1)}
      >
        −
      </Button>
      <span className="min-w-8 text-center tabular-nums text-sm">
        {card.quantity}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Increase ${card.name}`}
        onClick={() => void onBump(card, 1)}
      >
        +
      </Button>
    </div>
  )
}
