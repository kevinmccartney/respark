import { ManaCost } from '@respark/ui/mana';

import { FoilMark } from '@respark-client/cards';

import type { DeckCardGroup } from '../../types';
import { DeckCardMenu, DeckCardMenuToggle } from '../DeckCardMenu';

import { GroupHeader } from './GroupHeader';
import { TransformButton } from './TransformButton';
import type { BoardHandlers } from './types';

export const ListGroup = ({
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
    <div className="mb-6 break-inside-avoid">
      <GroupHeader group={group} />
      <ul>
        {group.cards.map((card) => {
          const isActive = previewCardId === card.id;
          const canTransform = card.faces.length > 1;
          return (
            <li key={card.id}>
              <DeckCardMenu card={card} {...handlers}>
                <div
                  className={
                    isActive
                      ? 'flex items-center gap-2 rounded-sm bg-muted/70 px-1 py-0.5'
                      : 'flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-muted/50'
                  }
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-sm text-muted-foreground">
                    {card.quantity}
                  </span>
                  <button
                    type="button"
                    className="min-w-0 truncate text-left text-sm font-medium"
                    onClick={() => handlers.onPreview(card.id)}
                  >
                    {card.name}
                  </button>
                  {canTransform ? (
                    <TransformButton
                      transformed={isActive && previewFaceIndex > 0}
                      onClick={() => onTransform(card.id)}
                    />
                  ) : null}
                  {card.foil ? <FoilMark /> : null}
                  <ManaCost cost={card.manaCost} size={12} className="ml-auto shrink-0" />
                  <DeckCardMenuToggle card={card} {...handlers} />
                </div>
              </DeckCardMenu>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
