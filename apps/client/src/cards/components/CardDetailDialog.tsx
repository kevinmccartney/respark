import { ExternalLink, LucideX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, Dialog, DialogClose, DialogContent, DialogDescription } from '@respark/ui/lib';

import { useCard } from '../hooks/cards';

import { CardDetailView } from './CardDetailView';

type Props = {
  cardId: string;
  /** Printing to show first; falls back to the newest printing. */
  printingId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CardDetailDialog = ({ cardId, printingId = null, open, onOpenChange }: Props) => {
  const { data: card, isPending, isError } = useCard(cardId, open);
  const [selectedId, setSelectedId] = useState(printingId);

  useEffect(() => {
    if (open) setSelectedId(printingId);
  }, [open, printingId]);

  const selectedPrinting =
    card?.printings.find((printing) => printing.id === selectedId) ?? card?.printings[0] ?? null;
  const pageHref = `/cards/${cardId}${
    selectedPrinting && selectedPrinting.id !== card?.printings[0]?.id
      ? `?printing=${selectedPrinting.id}`
      : ''
  }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,52rem)] w-[min(calc(100%-2rem),56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem]"
      >
        <div className="flex items-center justify-end gap-3 border-b px-4 py-3">
          <DialogDescription className="sr-only">Card details</DialogDescription>
          <div className="flex shrink-0 gap-2">
            <DialogClose
              render={<Button type="button" variant="ghost" size="sm" aria-label="Close" />}
            >
              <LucideX />
            </DialogClose>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 text-left">
          {isError ? (
            <p className="text-sm text-destructive">Could not load card.</p>
          ) : isPending || !card ? (
            <p className="text-sm text-muted-foreground">Loading card…</p>
          ) : (
            <CardDetailView
              card={card}
              selectedPrinting={selectedPrinting}
              onSelectPrinting={(printing) => setSelectedId(printing.id)}
              titleAs="h2"
              pageLink={
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link to={pageHref} onClick={() => onOpenChange(false)} />}
                >
                  <ExternalLink aria-hidden />
                  Open details page
                </Button>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
