import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';
import type { SpellbookClient } from '../spellbook/types';

import { getCardTool } from './get-card.tool';
import { getDeckTool } from './get-deck.tool';
import { listDecksTool } from './list-decks.tool';
import { lookupCombosTool } from './lookup-combos.tool';
import { presentRecommendationsTool } from './present-recommendations.tool';
import { searchCardsTool } from './search-cards.tool';
import type { ChatTool } from './types';

export const buildChatTools = (
  decks: DecksService,
  cards: CardsService,
  spellbook: SpellbookClient,
): ChatTool<unknown, unknown>[] => [
  listDecksTool(decks) as ChatTool<unknown, unknown>,
  getDeckTool(decks) as ChatTool<unknown, unknown>,
  searchCardsTool(decks, cards) as ChatTool<unknown, unknown>,
  getCardTool(cards) as ChatTool<unknown, unknown>,
  lookupCombosTool(decks, cards, spellbook) as ChatTool<unknown, unknown>,
  presentRecommendationsTool() as ChatTool<unknown, unknown>,
];
