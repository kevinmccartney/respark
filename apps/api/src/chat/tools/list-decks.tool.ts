import { listDecksInputSchema, type ListDecksInput, type ListDecksResult } from 'schemas/chat';
import type { DecksService } from '../../decks/decks.service';
import type { ChatTool } from './types';

const LIST_DECKS_CAP = 50;

export const listDecksTool = (decks: DecksService): ChatTool<ListDecksInput, ListDecksResult> => ({
  name: 'listDecks',
  description:
    'List the player’s decks (id, name, format, color identity). Use this to pick a deck id for getDeck instead of guessing UUIDs.',
  inputSchema: listDecksInputSchema,
  execute: async (_input, ctx) => {
    const decksForUser = await decks.listForUser(ctx.clerkUserId);
    return {
      ok: true,
      data: {
        decks: decksForUser.slice(0, LIST_DECKS_CAP).map((deck) => ({
          id: deck.id,
          name: deck.name,
          format: deck.format,
          colorIdentity: deck.colorIdentity,
        })),
      },
    };
  },
});
