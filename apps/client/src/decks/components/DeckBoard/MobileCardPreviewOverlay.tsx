import { createPortal } from 'react-dom';

import { FlippableCardImage, resolveCardFace } from '@respark-client/cards';

import type { DeckCard } from '../../types';

type Props = {
  card: DeckCard | null;
  faceIndex: number;
  open: boolean;
  onClose: () => void;
  onFlip: () => void;
};

export const MobileCardPreviewOverlay = ({ card, faceIndex, open, onClose, onFlip }: Props) => {
  if (!open || !card) return null;

  const { displayed, canFlip, nextFaceName } = resolveCardFace({
    faces: card.faces,
    faceIndex,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    imageNormal: card.imageNormal,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${displayed.name}`}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="w-full max-w-md" onClick={onClose}>
        <FlippableCardImage
          src={displayed.imageSrc}
          alt={displayed.name}
          foil={card.foil}
          canFlip={canFlip}
          nextFaceName={nextFaceName}
          onFlip={onFlip}
        />
      </div>
    </div>,
    document.body,
  );
};
