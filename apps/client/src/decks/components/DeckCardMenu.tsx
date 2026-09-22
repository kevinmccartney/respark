import { EllipsisVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@respark/ui/lib';

import type { DeckCard } from '../lib/decks';

type DeckCardMenuHandlers = {
  onPreview: (cardId: string) => void;
  onPickPrinting: (card: DeckCard) => void;
  onBump: (card: DeckCard, delta: number) => void;
  onToggleFoil: (card: DeckCard) => void;
  onToggleSideboard: (card: DeckCard) => void;
};

export const DeckCardMenu = ({
  card,
  children,
  ...handlers
}: {
  card: DeckCard;
  children: ReactNode;
} & DeckCardMenuHandlers) => (
  <ContextMenu>
    <ContextMenuTrigger
      className="block w-full"
      onMouseEnter={() => handlers.onPreview(card.id)}
      onFocusCapture={() => handlers.onPreview(card.id)}
    >
      {children}
    </ContextMenuTrigger>
    <ContextMenuContent className="min-w-48">
      <CardActionItems
        card={card}
        Item={ContextMenuItem}
        Separator={ContextMenuSeparator}
        {...handlers}
      />
    </ContextMenuContent>
  </ContextMenu>
);

export const DeckCardMenuToggle = ({
  card,
  align = 'end',
  ...handlers
}: {
  card: DeckCard;
  align?: 'start' | 'end';
} & DeckCardMenuHandlers) => (
  <DropdownMenu
    onOpenChange={(open) => {
      if (open) handlers.onPreview(card.id);
    }}
  >
    <DropdownMenuTrigger
      render={
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Actions for ${card.name}`}
        />
      }
    >
      <EllipsisVertical />
    </DropdownMenuTrigger>
    <DropdownMenuContent align={align} className="min-w-48 w-auto">
      <CardActionItems
        card={card}
        Item={DropdownMenuItem}
        Separator={DropdownMenuSeparator}
        {...handlers}
      />
    </DropdownMenuContent>
  </DropdownMenu>
);

const CardActionItems = ({
  card,
  Item,
  Separator,
  onPickPrinting,
  onBump,
  onToggleFoil,
  onToggleSideboard,
}: {
  card: DeckCard;
  Item: typeof DropdownMenuItem | typeof ContextMenuItem;
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
} & Omit<DeckCardMenuHandlers, 'onPreview'>) => (
  <>
    <Item render={<Link to={`/cards/${card.cardId}`} />}>View details</Item>
    <Item onClick={() => onPickPrinting(card)}>Change printing</Item>
    <Separator />
    {card.hasFoil ? (
      <Item onClick={() => void onToggleFoil(card)}>{card.foil ? 'Use non-foil' : 'Use foil'}</Item>
    ) : null}
    <Item onClick={() => void onToggleSideboard(card)}>
      {card.sideboard ? 'Move to mainboard' : 'Move to sideboard'}
    </Item>
    <Separator />
    <Item onClick={() => void onBump(card, 1)}>Increase quantity</Item>
    <Item onClick={() => void onBump(card, -1)}>
      {card.quantity <= 1 ? 'Remove from deck' : 'Decrease quantity'}
    </Item>
  </>
);
