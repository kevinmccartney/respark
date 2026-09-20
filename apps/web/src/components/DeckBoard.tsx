import { Link } from 'react-router-dom';
import { ManaCost, ManaText } from 'ui/mana';
import { ColorIdentity } from './ColorIdentity.tsx';
import { DeckCardMenu, DeckCardMenuToggle } from './DeckCardMenu.tsx';
import type { DeckCardGroup, DeckViewMode } from '../lib/deck-grouping.ts';
import type { DeckCard } from '../lib/decks.ts';

type BoardHandlers = {
  previewCardId: string | null;
  onPreview: (cardId: string) => void;
  onPickPrinting: (card: DeckCard) => void;
  onBump: (card: DeckCard, delta: number) => void;
  onToggleFoil: (card: DeckCard) => void;
  onToggleSideboard: (card: DeckCard) => void;
};

export const CardPreview = ({ card }: { card: DeckCard | null }) => {
  if (!card) {
    return (
      <aside className="w-full max-w-65 shrink-0 text-sm text-muted-foreground">
        Hover a card to preview it.
      </aside>
    );
  }

  return (
    <aside className="w-full max-w-65 shrink-0 lg:sticky lg:top-4">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-md bg-muted">
          {card.imageNormal ? (
            <img src={card.imageNormal} alt={card.name} className="h-auto w-full" />
          ) : (
            <div className="flex aspect-5/7 items-center justify-center p-6 text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link
              to={`/cards/${card.cardId}`}
              className="font-heading text-lg leading-tight hover:underline"
            >
              {card.name}
            </Link>
            <ManaCost cost={card.manaCost} size={14} />
          </div>
          {card.typeLine ? <p className="text-sm text-muted-foreground">{card.typeLine}</p> : null}
        </div>
        {card.oracleText ? (
          <ManaText
            text={card.oracleText}
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
          viewMode === 'list'
            ? 'flex flex-wrap items-start gap-x-8 gap-y-6'
            : 'flex flex-wrap items-start gap-x-5 gap-y-8'
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
  ...handlers
}: { group: DeckCardGroup } & BoardHandlers) => (
  <div className="min-w-55 max-w-75 flex-1">
    <GroupHeader group={group} />
    <ul>
      {group.cards.map((card) => {
        const isActive = previewCardId === card.id;
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

const VisualGroup = ({
  group,
  previewCardId,
  ...handlers
}: { group: DeckCardGroup } & BoardHandlers) => (
  <div className="w-44 shrink-0">
    <GroupHeader group={group} />
    <ul className="relative">
      {group.cards.map((card, index) => {
        const isActive = previewCardId === card.id;
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
                  {card.imageNormal ? (
                    <img
                      src={card.imageNormal}
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
