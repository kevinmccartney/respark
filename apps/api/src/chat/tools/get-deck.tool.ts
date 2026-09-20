import { getDeckInputSchema, type CompactDeck, type GetDeckInput } from 'schemas/chat';
import type { DecksService } from '../../decks/decks.service';
import { toCompactDeck } from './compact-deck';
import type { ChatTool } from './types';

export const getDeckTool = (decks: DecksService): ChatTool<GetDeckInput, CompactDeck> => ({
  name: 'getDeck',
  description:
    'Load a deck the player owns (format, commander, color identity, compact lines, type/curve stats). Uses the sticky deck when no id is passed. Passing an owned id attaches that deck for later turns.',
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
