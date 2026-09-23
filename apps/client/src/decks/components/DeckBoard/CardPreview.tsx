import { Link } from 'react-router-dom';

import { ManaCost, ManaText } from '@respark/ui/mana';

import { FlippableCardImage, resolveCardFace } from '@respark-client/cards';

import type { DeckCard } from '../../types';

export const CardPreview = ({
  card,
  faceIndex,
  onFlip,
}: {
  card: DeckCard | null;
  faceIndex: number;
  onFlip: () => void;
}) => {
  if (!card) {
    return (
      <aside className="w-full shrink-0 text-sm text-muted-foreground md:w-52 lg:w-65">
        Hover or long-press a card to preview it.
      </aside>
    );
  }

  const { displayed, canFlip, nextFaceName } = resolveCardFace({
    faces: card.faces,
    faceIndex,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    imageNormal: card.imageNormal,
  });

  return (
    <aside className="w-full shrink-0 md:sticky md:top-4 md:w-52 lg:w-65">
      <div className="space-y-3">
        <FlippableCardImage
          src={displayed.imageSrc}
          alt={displayed.name}
          foil={card.foil}
          canFlip={canFlip}
          nextFaceName={nextFaceName}
          onFlip={onFlip}
        />
        <div className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              to={`/cards/${card.cardId}`}
              className="font-heading text-lg leading-tight hover:underline"
            >
              {displayed.name}
            </Link>
            <ManaCost cost={displayed.manaCost} size={14} />
          </div>
          {displayed.typeLine ? (
            <p className="text-sm text-muted-foreground">{displayed.typeLine}</p>
          ) : null}
        </div>
        {displayed.oracleText ? (
          <ManaText
            text={displayed.oracleText}
            className="text-sm leading-relaxed whitespace-pre-wrap"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No oracle text.</p>
        )}
        <p className="text-xs text-muted-foreground">
          {card.setCode.toUpperCase()} #{card.collectorNumber}
          {card.foil ? ' · Foil' : ''}
        </p>
      </div>
    </aside>
  );
};
