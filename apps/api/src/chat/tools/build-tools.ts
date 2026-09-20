import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';
import { getCardTool } from './get-card.tool';
import { getDeckTool } from './get-deck.tool';
import { listDecksTool } from './list-decks.tool';
import { presentRecommendationsTool } from './present-recommendations.tool';
import { searchCardsTool } from './search-cards.tool';
import type { ChatTool } from './types';

export const buildChatTools = (
  decks: DecksService,
  cards: CardsService,
): ChatTool<unknown, unknown>[] => [
  listDecksTool(decks) as ChatTool<unknown, unknown>,
  getDeckTool(decks) as ChatTool<unknown, unknown>,
  searchCardsTool(decks, cards) as ChatTool<unknown, unknown>,
  getCardTool(cards) as ChatTool<unknown, unknown>,
  presentRecommendationsTool() as ChatTool<unknown, unknown>,
];
