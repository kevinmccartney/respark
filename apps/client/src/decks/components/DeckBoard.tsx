import { RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ManaCost, ManaText } from '@respark/ui/mana';

import { ColorIdentity, FlippableCardImage, FoilMark, resolveCardFace } from '@/cards';

import type { DeckCardGroup, DeckViewMode } from '../lib/deck-grouping';
import type { DeckCard } from '../lib/decks';

import { DeckCardMenu, DeckCardMenuToggle } from './DeckCardMenu';

type BoardHandlers = {
  previewCardId: string | null;
  previewFaceIndex: number;
  onPreview: (cardId: string) => void;
  onTransform: (cardId: string) => void;
  onPickPrinting: (card: DeckCard) => void;
  onBump: (card: DeckCard, delta: number) => void;
  onToggleFoil: (card: DeckCard) => void;
  onToggleSideboard: (card: DeckCard) => void;
};

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
      <aside className="w-full max-w-65 shrink-0 text-sm text-muted-foreground">
        Hover a card to preview it.
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
    <aside className="w-full max-w-65 shrink-0 lg:sticky lg:top-4">
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

export const BoardSection = ({
  title,
  showTitle,
  groups,
  viewMode,
  ...handlers
}: {
  title: string;
  showTitle: boolean;
  groups: DeckCardGroup[];
  viewMode: DeckViewMode;
} & BoardHandlers) => {
  const total = groups.reduce((sum, group) => sum + group.totalQuantity, 0);

  return (
    <div className="space-y-3">
      {showTitle ? (
        <h3 className="font-heading text-lg">
          {title} <span className="text-sm font-normal text-muted-foreground">({total})</span>
        </h3>
      ) : null}
      <div
        className={
          viewMode === 'list' ? 'columns-3xs gap-x-8' : 'flex flex-wrap items-start gap-x-5 gap-y-8'
        }
      >
        {groups.map((group) =>
          viewMode === 'list' ? (
            <ListGroup key={`${title}-${group.key}`} group={group} {...handlers} />
          ) : (
            <VisualGroup key={`${title}-${group.key}`} group={group} {...handlers} />
          ),
        )}
      </div>
    </div>
  );
};

const TransformButton = ({
  transformed,
  onClick,
  className,
}: {
  transformed: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    title="Click to transform card"
    aria-label="Click to transform card"
    className={
      className ??
      (transformed
        ? 'shrink-0 text-primary hover:text-primary'
        : 'shrink-0 text-muted-foreground hover:text-foreground')
    }
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    <RotateCw className="size-3.5" />
  </button>
);

const GroupHeader = ({ group }: { group: DeckCardGroup }) => (
  <h4 className="mb-2 flex items-center gap-1.5 border-b pb-1 font-heading text-sm">
    {group.colorIdentity ? <ColorIdentity colors={group.colorIdentity} size={14} /> : null}
    <span>
      {group.label}{' '}
      <span className="font-normal text-muted-foreground">({group.totalQuantity})</span>
    </span>
  </h4>
);

const ListGroup = ({
  group,
  previewCardId,
  previewFaceIndex,
  onPreview,
  onTransform,
  onPickPrinting,
  onBump,
  onToggleFoil,
  onToggleSideboard,
}: { group: DeckCardGroup } & BoardHandlers) => {
  const handlers = { onPreview, onPickPrinting, onBump, onToggleFoil, onToggleSideboard };
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
                    className="min-w-0 truncate text-left text-sm font-medium hover:underline"
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

const VisualGroup = ({
  group,
  previewCardId,
  previewFaceIndex,
  onPreview,
  onTransform,
  onPickPrinting,
  onBump,
  onToggleFoil,
  onToggleSideboard,
}: { group: DeckCardGroup } & BoardHandlers) => {
  const handlers = { onPreview, onPickPrinting, onBump, onToggleFoil, onToggleSideboard };
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
