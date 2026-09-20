import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/core/ui/alert';
import { Button } from '@/core/ui/button';
import { PrintingPickerDialog } from '@/cards';
import { useChatSession } from '@/chat';
import { NotFoundPage } from '@/core';
import { BoardSection, CardPreview } from '../components/DeckBoard.tsx';
import { DeckAddCardSearch } from '../components/DeckAddCardSearch.tsx';
import { DeckDetailsHeader } from '../components/DeckDetailsHeader.tsx';
import { DeckImportDialog } from '../components/DeckImportDialog.tsx';
import { DeckListToolbar } from '../components/DeckListToolbar.tsx';
import { useDeckDetail } from '../hooks/useDeckDetail.ts';
import {
  commanderDeckGroup,
  groupDeckCards,
  type DeckGroupMode,
  type DeckSortMode,
  type DeckViewMode,
} from '../lib/deck-grouping.ts';
import type { DeckCard } from '../lib/decks.ts';

export const DeckDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deckId: stickyDeckId, setDeck } = useChatSession();
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
  const [previewFaceIndex, setPreviewFaceIndex] = useState(0);
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
  const commanderPrintingId = detail?.deck.commanderPrintingId ?? null;
  const commanderCards = useMemo(
    () =>
      commanderPrintingId
        ? mainboardCards.filter((card) => card.printingId === commanderPrintingId)
        : [],
    [commanderPrintingId, mainboardCards],
  );
  const restMainboardCards = useMemo(
    () =>
      commanderPrintingId
        ? mainboardCards.filter((card) => card.printingId !== commanderPrintingId)
        : mainboardCards,
    [commanderPrintingId, mainboardCards],
  );
  const mainGroups = useMemo(() => {
    const rest = groupDeckCards(restMainboardCards, groupMode, sortMode);
    const commander = commanderDeckGroup(commanderCards, sortMode);
    return commander ? [commander, ...rest] : rest;
  }, [commanderCards, restMainboardCards, groupMode, sortMode]);
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
      setPreviewFaceIndex(0);
      return;
    }
    if (previewCardId && previewableCards.some((card) => card.id === previewCardId)) {
      return;
    }
    setPreviewCardId(previewableCards[0]?.id ?? null);
    setPreviewFaceIndex(0);
  }, [previewableCards, previewCardId]);

  const previewCardById = (cardId: string) => {
    if (cardId !== previewCardId) setPreviewFaceIndex(0);
    setPreviewCardId(cardId);
  };

  const transformCard = (cardId: string) => {
    const card = previewableCards.find((entry) => entry.id === cardId);
    const faceCount = card?.faces.length ?? 0;
    if (faceCount < 2) return;
    if (cardId === previewCardId) {
      setPreviewFaceIndex((current) => (current + 1) % faceCount);
      return;
    }
    setPreviewCardId(cardId);
    setPreviewFaceIndex(1);
  };

  const mainTotal = mainboardCards.reduce((sum, card) => sum + card.quantity, 0);
  const sideTotal = sideboardCards.reduce((sum, card) => sum + card.quantity, 0);
  const commanderName =
    detail?.cards.find((card) => card.printingId === detail.deck.commanderPrintingId)?.name ?? null;

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
            commanderName={commanderName}
            mainTotal={mainTotal}
            sideTotal={sideTotal}
            uniqueCount={mainboardCards.length}
            onImport={() => setImportOpen(true)}
            onSave={saveDetails}
            onBeginEdit={clearActionError}
            onDelete={async () => {
              const ok = await remove();
              if (ok) {
                if (stickyDeckId === id) setDeck(null);
                navigate('/home');
              }
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
                  format={detail.deck.format}
                  colorIdentity={detail.deck.colorIdentity}
                  onAdd={async (suggestion) => {
                    const card = await addCard(suggestion.id);
                    if (!card) return false;
                    setPreviewCardId(card.id);
                    setPreviewFaceIndex(0);
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
                <CardPreview
                  card={previewCard}
                  faceIndex={previewFaceIndex}
                  onFlip={() => {
                    if (previewCard) transformCard(previewCard.id);
                  }}
                />
                <div className="min-w-0 flex-1 space-y-8">
                  {mainboardCards.length > 0 ? (
                    <BoardSection
                      title="Mainboard"
                      showTitle={sideboardCards.length > 0}
                      groups={mainGroups}
                      viewMode={viewMode}
                      previewCardId={previewCard?.id ?? null}
                      previewFaceIndex={previewFaceIndex}
                      onPreview={previewCardById}
                      onTransform={transformCard}
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
                      previewFaceIndex={previewFaceIndex}
                      onPreview={previewCardById}
                      onTransform={transformCard}
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
