import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError, isAbortError } from '../lib/api.ts';
import { fetchCard, type CardPrintingSummary } from '../lib/cards.ts';
import type { DeckCard } from '../lib/decks.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckCard: DeckCard | null;
  onSelect: (printingId: string) => Promise<void>;
};

export const PrintingPickerDialog = ({ open, onOpenChange, deckCard, onSelect }: Props) => {
  const { getToken } = useAuth();
  const [printings, setPrintings] = useState<CardPrintingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !deckCard) {
      setPrintings([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetchCard(getToken, deckCard.cardId, { signal: controller.signal })
      .then((detail) => {
        if (!controller.signal.aborted) {
          setPrintings(detail.printings);
        }
      })
      .catch((err) => {
        if (isAbortError(err) || controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Could not load printings');
        setPrintings([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, deckCard, getToken]);

  const handleSelect = async (printing: CardPrintingSummary) => {
    if (!deckCard || savingId) return;
    if (printing.id === deckCard.printingId) {
      onOpenChange(false);
      return;
    }
    setSavingId(printing.id);
    setError(null);
    try {
      await onSelect(printing.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change printing');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle>
                {deckCard ? `Printing · ${deckCard.name}` : 'Choose printing'}
              </DialogTitle>
              <DialogDescription>Pick which set version sits in this deck.</DialogDescription>
            </div>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Close
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading printings…</p> : null}
            {error ? (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {!loading && printings.length === 0 && !error ? (
              <p className="text-sm text-muted-foreground">No printings found.</p>
            ) : null}
            {printings.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {printings.map((printing) => {
                  const active = printing.id === deckCard?.printingId;
                  return (
                    <li key={printing.id}>
                      <button
                        type="button"
                        disabled={savingId !== null}
                        onClick={() => void handleSelect(printing)}
                        className={`flex w-full flex-col gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-50 ${
                          active ? 'border-primary bg-muted/40' : ''
                        }`}
                      >
                        <div className="bg-muted aspect-5/7 overflow-hidden rounded-md">
                          {printing.imageNormal ? (
                            <img
                              src={printing.imageNormal}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {printing.setCode.toUpperCase()}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            #{printing.collectorNumber}
                            {printing.rarity ? ` · ${printing.rarity}` : ''}
                          </p>
                          {savingId === printing.id ? (
                            <p className="text-xs text-muted-foreground">Saving…</p>
                          ) : active ? (
                            <p className="text-xs text-muted-foreground">Current</p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
};
