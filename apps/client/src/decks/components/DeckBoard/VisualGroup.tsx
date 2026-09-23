import { FoilMark, resolveCardFace } from '@respark-client/cards';

import type { DeckCardGroup } from '../../types';
import { DeckCardMenu, DeckCardMenuToggle } from '../DeckCardMenu';

import { GroupHeader } from './GroupHeader';
import { TransformButton } from './TransformButton';
import type { BoardHandlers } from './types';

export const VisualGroup = ({
  group,
  previewCardId,
  previewFaceIndex,
  onPreview,
  onMobilePreview,
  onTransform,
  onPickPrinting,
  onBump,
  onToggleFoil,
  onToggleSideboard,
}: { group: DeckCardGroup } & BoardHandlers) => {
  const handlers = {
    onPreview,
    onMobilePreview,
    onPickPrinting,
    onBump,
    onToggleFoil,
    onToggleSideboard,
  };
  return (
    <div className="w-44 shrink-0">
      <GroupHeader group={group} />
      <ul className="relative">
        {group.cards.map((card, index) => {
          const isActive = previewCardId === card.id;
          const canTransform = card.faces.length > 1;
          const imageSrc = resolveCardFace({
            faces: card.faces,
            faceIndex: isActive ? previewFaceIndex : 0,
            name: card.name,
            manaCost: card.manaCost,
            typeLine: card.typeLine,
            oracleText: card.oracleText,
            imageNormal: card.imageNormal,
          }).displayed.imageSrc;
          return (
            <li
              key={card.id}
              className="group/stack relative"
              style={{ marginTop: index === 0 ? 0 : '-13.5rem', zIndex: isActive ? 40 : index }}
            >
              <DeckCardMenu card={card} {...handlers}>
                <div className="relative">
                  <button
                    type="button"
                    className={
                      isActive
                        ? 'block w-full overflow-hidden rounded-md ring-2 ring-ring'
                        : 'block w-full overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    }
                    onClick={() => handlers.onPreview(card.id)}
                    aria-label={`Preview ${card.name}`}
                  >
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={card.name}
                        className="aspect-5/7 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-5/7 items-center justify-center bg-muted px-2 text-center text-sm font-medium">
                        {card.name}
                      </div>
                    )}
                  </button>
                  {card.quantity > 1 ? (
                    <span className="absolute top-1.5 left-1.5 rounded-sm bg-background/90 px-1.5 text-xs font-medium tabular-nums shadow-sm">
                      {card.quantity}
                    </span>
                  ) : null}
                  {card.foil ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded-sm bg-background/90 px-1.5 py-0.5">
                      <FoilMark />
                    </span>
                  ) : null}
                  {canTransform ? (
                    <TransformButton
                      transformed={isActive && previewFaceIndex > 0}
                      onClick={() => onTransform(card.id)}
                      className={
                        isActive && previewFaceIndex > 0
                          ? 'absolute right-1.5 bottom-1.5 rounded-sm bg-background/90 p-0.5 text-primary shadow-sm'
                          : 'absolute right-1.5 bottom-1.5 rounded-sm bg-background/90 p-0.5 text-muted-foreground shadow-sm hover:text-foreground'
                      }
                    />
                  ) : null}
                  <div
                    className={
                      isActive
                        ? 'absolute top-1 right-1 rounded-md bg-background/80 shadow-sm'
                        : 'absolute top-1 right-1 rounded-md bg-background/80 opacity-0 shadow-sm group-hover/stack:opacity-100 group-focus-within/stack:opacity-100 has-data-popup-open:opacity-100'
                    }
                  >
                    <DeckCardMenuToggle card={card} {...handlers} />
                  </div>
                </div>
              </DeckCardMenu>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
