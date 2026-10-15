import { useState } from 'react';

import type { DeckCardChange } from '@respark/schemas/deck-revisions';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@respark/ui/lib';

import { CardDetailDialog, useCard } from '@respark-client/cards';

/** Card name that previews the changed printing on hover and opens its details on click. */
export const DeckChangeCardName = ({ change }: { change: DeckCardChange }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data: card, isError: failed } = useCard(change.cardId, previewOpen);
  const printing =
    card?.printings.find((entry) => entry.id === change.printingId) ?? card?.printings[0];
  const src = printing?.imageNormal ?? null;

  return (
    <>
      <HoverCard open={previewOpen} onOpenChange={(next) => setPreviewOpen(next)}>
        <HoverCardTrigger
          delay={250}
          closeDelay={120}
          render={
            <button
              type="button"
              onClick={() => {
                setPreviewOpen(false);
                setDetailsOpen(true);
              }}
              className="inline cursor-pointer text-left underline decoration-dotted decoration-from-font underline-offset-2 hover:decoration-solid"
            />
          }
        >
          {change.name}
        </HoverCardTrigger>
        <HoverCardContent side="right" align="center" className="w-52 p-1">
          {failed ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Card unavailable</p>
          ) : src ? (
            <img src={src} alt="" className="h-auto w-full rounded-md" />
          ) : (
            <div className="flex aspect-5/7 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
              {card ? 'No image' : '…'}
            </div>
          )}
        </HoverCardContent>
      </HoverCard>

      <CardDetailDialog
        cardId={change.cardId}
        printingId={change.printingId}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
};
