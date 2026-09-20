import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BoardSection, CardPreview } from '../components/DeckBoard.tsx';
import { DeckAddCardSearch } from '../components/DeckAddCardSearch.tsx';
import { DeckDetailsHeader } from '../components/DeckDetailsHeader.tsx';
import { DeckImportDialog } from '../components/DeckImportDialog.tsx';
import { DeckListToolbar } from '../components/DeckListToolbar.tsx';
import { PrintingPickerDialog } from '../components/PrintingPickerDialog.tsx';
import {
  groupDeckCards,
  type DeckGroupMode,
  type DeckSortMode,
  type DeckViewMode,
} from '../lib/deck-grouping.ts';
import type { DeckCard } from '../lib/decks.ts';
import { useDeckDetail } from '../lib/useDeckDetail.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

export const DeckDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    detail,
    setDetail,
    loading,
    error,
    notFound,
    actionError,
    addCard,
    bumpQuantity,
    setPrinting,
    toggleFoil,
    toggleSideboard,
    saveDetails,
    remove,
    clearActionError,
  } = useDeckDetail(id);

  const [viewMode, setViewMode] = useState<DeckViewMode>('list');
  const [groupMode, setGroupMode] = useState<DeckGroupMode>('type');
  const [sortMode, setSortMode] = useState<DeckSortMode>('name');
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [pickingCard, setPickingCard] = useState<DeckCard | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
          <DeckDetailsHeader
            deck={detail.deck}
            mainTotal={mainTotal}
            sideTotal={sideTotal}
            uniqueCount={mainboardCards.length}
            onImport={() => setImportOpen(true)}
            onSave={saveDetails}
            onBeginEdit={clearActionError}
            onDelete={async () => {
              const ok = await remove();
              if (ok) navigate('/home');
              return ok;
            }}
          />

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
                <DeckAddCardSearch
                  onAdd={async (suggestion) => {
                    const card = await addCard(suggestion.id);
                    if (!card) return false;
                    setPreviewCardId(card.id);
                    return true;
                  }}
                />
                {detail.cards.length > 0 ? (
                  <DeckListToolbar
                    viewMode={viewMode}
                    groupMode={groupMode}
                    sortMode={sortMode}
                    onViewModeChange={setViewMode}
                    onGroupModeChange={setGroupMode}
                    onSortModeChange={setSortMode}
                  />
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
            onSelect={async (printingId) => {
              if (!pickingCard) return;
              await setPrinting(pickingCard.id, printingId);
            }}
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
  );
};
