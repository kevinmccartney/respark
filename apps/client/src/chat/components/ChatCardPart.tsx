import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ManaCost } from '@respark/ui/mana';

import { fetchCard, type CardDetail } from '@/cards';
import { isAbortError } from '@/core';

export const ChatCardPart = ({ cardIds }: { cardIds: string[] }) => (
  <ul className="grid grid-cols-3 gap-2">
    {cardIds.map((cardId) => (
      <li key={cardId}>
        <ChatCardThumb cardId={cardId} />
      </li>
    ))}
  </ul>
);

const ChatCardThumb = ({ cardId }: { cardId: string }) => {
  const { getToken } = useAuth();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const detail = await fetchCard(getToken, cardId, { signal: controller.signal });
        if (!controller.signal.aborted) setCard(detail);
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return;
        setFailed(true);
      }
    };
    void load();
    return () => controller.abort();
  }, [cardId, getToken]);

  if (failed) {
    return <p className="text-xs text-muted-foreground">Card unavailable</p>;
  }

  const printing = card?.printings[0];
  const src = printing?.imageNormal ?? null;

  return (
    <Link to={`/cards/${cardId}`} className="block space-y-1">
      {src ? (
        <img src={src} alt={card?.name ?? 'Card'} className="h-auto w-full rounded-md" />
      ) : (
        <div className="flex aspect-5/7 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          {card ? 'No image' : '…'}
        </div>
      )}
      <span className="flex items-start justify-between gap-1">
        <span className="font-heading text-xs leading-tight">{card?.name ?? 'Loading…'}</span>
        {card ? <ManaCost cost={card.manaCost} size={10} /> : null}
      </span>
    </Link>
  );
};
