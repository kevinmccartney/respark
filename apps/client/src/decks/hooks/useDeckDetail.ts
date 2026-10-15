import { useAuth } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  countDeckChanges,
  deckSnapshotFromDetail,
  diffDeck,
  type DeckChanges,
} from '@respark/schemas/deck-revisions';
import type { CreateDeckInput, DeckCard, DeckDetail } from '@respark/schemas/decks';
import { uuidSchema } from '@respark/schemas/primitives';

import { ApiError, isNotFound } from '@respark-client/core';

import {
  addCardToDeck,
  createDeck,
  deleteDeck,
  discardDeckChanges,
  fetchDeck,
  fetchDeckRevisions,
  fetchDeckSavedState,
  fetchDecks,
  importDeckList,
  patchDeckCard,
  removeDeckCard,
  saveDeck,
  updateDeck,
} from '../api/decks';
import { upsertDeckCard, withDeckCards } from '../lib/deck-cards';
import type { SaveDeckDetailsInput } from '../types';

export const SAVED_NOTICE_MS = 10_000;

export const deckKeys = {
  all: ['decks'] as const,
  list: () => [...deckKeys.all, 'list'] as const,
  detail: (id: string) => [...deckKeys.all, 'detail', id] as const,
  saved: (id: string) => [...deckKeys.all, 'saved', id] as const,
  revisions: (id: string) => [...deckKeys.all, 'revisions', id] as const,
};

export const useDeckRevisions = (id: string) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: deckKeys.revisions(id),
    queryFn: ({ signal }) => fetchDeckRevisions(getToken, id, { signal }),
    enabled: uuidSchema.safeParse(id).success,
  });
};

const useDeckSavedState = (id: string) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: deckKeys.saved(id),
    queryFn: ({ signal }) => fetchDeckSavedState(getToken, id, { signal }),
    enabled: uuidSchema.safeParse(id).success,
  });
};

export const useDecks = () => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: deckKeys.list(),
    queryFn: ({ signal }) => fetchDecks(getToken, { signal }),
  });
};

export const useDeck = (id: string) => {
  const { getToken } = useAuth();
  const validId = uuidSchema.safeParse(id).success;
  return useQuery({
    queryKey: deckKeys.detail(id),
    queryFn: ({ signal }) => fetchDeck(getToken, id, { signal }),
    enabled: validId,
  });
};

export const useCreateDeck = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeckInput) => createDeck(getToken, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deckKeys.list() });
    },
  });
};

export const useDeleteDeck = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDeck(getToken, id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: deckKeys.list() });
      queryClient.removeQueries({ queryKey: deckKeys.detail(id) });
    },
  });
};

export const useImportDeckList = (deckId: string) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => importDeckList(getToken, deckId, text),
    onSuccess: (result) => {
      queryClient.setQueryData(deckKeys.detail(deckId), result.detail);
    },
  });
};

const patchDetail = (
  queryClient: ReturnType<typeof useQueryClient>,
  deckId: string,
  updater: (prev: DeckDetail) => DeckDetail,
) => {
  queryClient.setQueryData<DeckDetail>(deckKeys.detail(deckId), (prev) =>
    prev ? updater(prev) : prev,
  );
};

export const useDeckDetail = (id: string) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const query = useDeck(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<{ message: string; at: number } | null>(null);

  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(null), SAVED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);

  const detail = query.data ?? null;
  const savedState = useDeckSavedState(id).data;
  const pendingChanges: DeckChanges | null =
    detail && savedState ? diffDeck(savedState.snapshot, deckSnapshotFromDetail(detail)) : null;
  const notFound = Boolean(query.error && isNotFound(query.error));
  const error =
    query.error && !isNotFound(query.error)
      ? query.error instanceof ApiError
        ? query.error.message
        : 'Could not load deck'
      : null;

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
      patchDetail(queryClient, current.deck.id, (prev) => upsertDeckCard(prev, card.id, card));
      return card;
    }, 'Could not add card');

  const bumpQuantity = async (card: DeckCard, delta: number): Promise<void> => {
    await runAction(async (current) => {
      const nextQty = card.quantity + delta;
      if (nextQty <= 0) {
        await removeDeckCard(getToken, current.deck.id, card.id);
        patchDetail(queryClient, current.deck.id, (prev) =>
          withDeckCards(
            prev,
            prev.cards.filter((row) => row.id !== card.id),
          ),
        );
        return;
      }
      const updated = await patchDeckCard(getToken, current.deck.id, card.id, {
        quantity: nextQty,
      });
      if (updated) {
        patchDetail(queryClient, current.deck.id, (prev) => upsertDeckCard(prev, card.id, updated));
      }
    }, 'Could not update quantity');
  };

  const setPrinting = async (deckCardId: string, printingId: string): Promise<void> => {
    if (!detail) return;
    const previous = detail.cards.find((row) => row.id === deckCardId);
    const updated = await patchDeckCard(getToken, detail.deck.id, deckCardId, { printingId });
    if (!updated) return;
    patchDetail(queryClient, detail.deck.id, (prev) => {
      const next = upsertDeckCard(prev, deckCardId, updated);
      if (!previous || prev.deck.commanderPrintingId !== previous.printingId) return next;
      return {
        ...next,
        deck: { ...next.deck, commanderPrintingId: updated.printingId },
      };
    });
  };

  const toggleFoil = async (card: DeckCard): Promise<void> => {
    await runAction(async (current) => {
      const updated = await patchDeckCard(getToken, current.deck.id, card.id, {
        foil: !card.foil,
      });
      if (updated) {
        patchDetail(queryClient, current.deck.id, (prev) => upsertDeckCard(prev, card.id, updated));
      }
    }, 'Could not update foil');
  };

  const toggleSideboard = async (card: DeckCard): Promise<void> => {
    await runAction(async (current) => {
      const updated = await patchDeckCard(getToken, current.deck.id, card.id, {
        sideboard: !card.sideboard,
      });
      if (updated) {
        patchDetail(queryClient, current.deck.id, (prev) => upsertDeckCard(prev, card.id, updated));
      }
    }, 'Could not move card');
  };

  const saveDetails = async (input: SaveDeckDetailsInput): Promise<boolean> => {
    if (!input.name.trim()) {
      setActionError('Name is required');
      return false;
    }
    const ok = await runAction(async (current) => {
      await updateDeck(getToken, current.deck.id, input);
      const next = await fetchDeck(getToken, current.deck.id);
      queryClient.setQueryData(deckKeys.detail(current.deck.id), next);
      await queryClient.invalidateQueries({ queryKey: deckKeys.saved(current.deck.id) });
      void queryClient.invalidateQueries({ queryKey: deckKeys.revisions(current.deck.id) });
      void queryClient.invalidateQueries({ queryKey: deckKeys.list() });
      setSavedNotice({ message: 'Deck details saved.', at: Date.now() });
      return true;
    }, 'Could not save deck details');
    return ok === true;
  };

  const save = async (note: string): Promise<boolean> => {
    const ok = await runAction(async (current) => {
      await saveDeck(getToken, current.deck.id, note.trim() ? { note: note.trim() } : {});
      await queryClient.invalidateQueries({ queryKey: deckKeys.saved(current.deck.id) });
      void queryClient.invalidateQueries({ queryKey: deckKeys.revisions(current.deck.id) });
      setSavedNotice({ message: 'All changes saved.', at: Date.now() });
      return true;
    }, 'Could not save deck');
    return ok === true;
  };

  const discard = async (): Promise<boolean> => {
    const ok = await runAction(async (current) => {
      const next = await discardDeckChanges(getToken, current.deck.id);
      queryClient.setQueryData(deckKeys.detail(current.deck.id), next);
      void queryClient.invalidateQueries({ queryKey: deckKeys.list() });
      return true;
    }, 'Could not discard changes');
    return ok === true;
  };

  const remove = async (): Promise<boolean> => {
    const ok = await runAction(async (current) => {
      await deleteDeck(getToken, current.deck.id);
      void queryClient.invalidateQueries({ queryKey: deckKeys.list() });
      queryClient.removeQueries({ queryKey: deckKeys.detail(current.deck.id) });
      return true;
    }, 'Could not delete deck');
    return ok === true;
  };

  return {
    detail,
    loading: query.isPending,
    error,
    notFound,
    actionError,
    addCard,
    bumpQuantity,
    setPrinting,
    toggleFoil,
    toggleSideboard,
    saveDetails,
    pendingChanges,
    pendingCount: pendingChanges ? countDeckChanges(pendingChanges) : 0,
    savedAt: savedState?.savedAt ?? null,
    savedNotice,
    dismissSavedNotice: () => setSavedNotice(null),
    save,
    discard,
    remove,
    clearActionError: () => setActionError(null),
  };
};
