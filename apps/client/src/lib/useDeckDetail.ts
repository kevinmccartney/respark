import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { uuidSchema } from 'schemas/primitives';
import { ApiError, isAbortError, isNotFound } from './api.ts';
import {
  addCardToDeck,
  deleteDeck,
  fetchDeck,
  removeDeckCard,
  setDeckCardFoil,
  setDeckCardPrinting,
  setDeckCardQuantity,
  setDeckCardSideboard,
  updateDeck,
  upsertDeckCard,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
} from './decks.ts';

type SaveDeckDetailsInput = {
  name: string;
  format: DeckFormat;
  description: string | null;
};

export const useDeckDetail = (id: string) => {
  const { getToken } = useAuth();
  const [detail, setDetail] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        const next = await fetchDeck(getToken, id, { signal: controller.signal });
        if (!controller.signal.aborted) setDetail(next);
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return;
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

  const replaceCard = (previousId: string, next: DeckCard) => {
    setDetail((prev) => (prev ? upsertDeckCard(prev, previousId, next) : prev));
  };

  const runAction = async <T>(
    fn: (current: DeckDetail) => Promise<T>,
    fallback: string,
  ): Promise<T | undefined> => {
    if (!detail) return undefined;
    setActionError(null);
    try {
      return await fn(detail);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : fallback);
      return undefined;
    }
  };

  const addCard = (cardId: string): Promise<DeckCard | undefined> =>
    runAction(async (current) => {
      const card = await addCardToDeck(getToken, current.deck.id, cardId);
      replaceCard(card.id, card);
      return card;
    }, 'Could not add card');

  const bumpQuantity = async (card: DeckCard, delta: number): Promise<void> => {
    await runAction(async (current) => {
      const nextQty = card.quantity + delta;
      if (nextQty <= 0) {
        await removeDeckCard(getToken, current.deck.id, card.id);
        setDetail((prev) =>
          prev ? { ...prev, cards: prev.cards.filter((row) => row.id !== card.id) } : prev,
        );
        return;
      }
      const updated = await setDeckCardQuantity(getToken, current.deck.id, card.id, nextQty);
      if (updated) replaceCard(card.id, updated);
    }, 'Could not update quantity');
  };

  const setPrinting = async (deckCardId: string, printingId: string): Promise<void> => {
    if (!detail) return;
    const updated = await setDeckCardPrinting(getToken, detail.deck.id, deckCardId, printingId);
    replaceCard(deckCardId, updated);
  };

  const toggleFoil = async (card: DeckCard): Promise<void> => {
    await runAction(async (current) => {
      const updated = await setDeckCardFoil(getToken, current.deck.id, card.id, !card.foil);
      replaceCard(card.id, updated);
    }, 'Could not update foil');
  };

  const toggleSideboard = async (card: DeckCard): Promise<void> => {
    await runAction(async (current) => {
      const updated = await setDeckCardSideboard(
        getToken,
        current.deck.id,
        card.id,
        !card.sideboard,
      );
      replaceCard(card.id, updated);
    }, 'Could not move card');
  };

  const saveDetails = async (input: SaveDeckDetailsInput): Promise<boolean> => {
    if (!input.name.trim()) {
      setActionError('Name is required');
      return false;
    }
    const ok = await runAction(async (current) => {
      const deck = await updateDeck(getToken, current.deck.id, input);
      setDetail((prev) => (prev ? { ...prev, deck } : prev));
      return true;
    }, 'Could not save deck details');
    return ok === true;
  };

  const remove = async (): Promise<boolean> => {
    const ok = await runAction(async (current) => {
      await deleteDeck(getToken, current.deck.id);
      return true;
    }, 'Could not delete deck');
    return ok === true;
  };

  return {
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
    clearActionError: () => setActionError(null),
  };
};
