import { Link as LinkIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { HoverCard, HoverCardContent, HoverCardTrigger } from '@respark/ui/lib';

import { useCard } from '@respark-client/cards';

export const ChatCardLink = ({ cardId, children }: { cardId: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { data: card, isError: failed } = useCard(cardId, open);
  const src = card?.printings[0]?.imageNormal ?? null;

  return (
    <HoverCard open={open} onOpenChange={(next) => setOpen(next)}>
      <HoverCardTrigger
        delay={250}
        closeDelay={120}
        render={
          <Link
            to={`/cards/${cardId}`}
            className="inline underline decoration-from-font underline-offset-2"
          />
        }
      >
        {children}
        <LinkIcon className="mb-0.5 ml-0.5 inline size-3 align-middle opacity-70" aria-hidden />
      </HoverCardTrigger>
      <HoverCardContent side="left" align="center" className="w-52 p-1">
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
  );
};
