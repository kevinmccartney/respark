import { getDeckInputSchema, type CompactDeck, type GetDeckInput } from '@respark/schemas/chat';

import type { DecksService } from '../../decks/decks.service';

import { toCompactDeck } from './compact-deck';
import type { ChatTool } from './types';

export const getDeckTool = (decks: DecksService): ChatTool<GetDeckInput, CompactDeck> => ({
  name: 'getDeck',
  description:
    'Load a deck the player owns (format, commander with oracle/keywords, compact lines, type/curve/keyword stats). Use commander oracle and stats.keywordCounts when choosing searchCards scryfall (e.g. t:creature kw:flying); do not search with an empty query when the list has a theme. Uses the sticky deck when no id is passed. Passing an owned id attaches that deck for later turns.',
  inputSchema: getDeckInputSchema,
  execute: async (input, ctx) => {
    const deckId = input.deckId ?? ctx.deckId;
    if (!deckId) {
      return {
        ok: false,
        code: 'no_deck_context',
        message: 'this conversation has no deck',
      };
    }
    const detail = await decks.getForUser(ctx.clerkUserId, deckId);
    ctx.deckId = detail.deck.id;
    return { ok: true, data: toCompactDeck(detail) };
  },
});
