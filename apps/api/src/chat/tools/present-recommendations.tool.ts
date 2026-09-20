import {
  PRESENT_RECOMMENDATIONS_MAX,
  presentRecommendationsInputSchema,
  type PresentRecommendationsInput,
} from 'schemas/chat';
import { allowlistCardIds } from '../allowlist';
import type { ChatTool } from './types';

export type PresentRecommendationsResult = {
  cardIds: string[];
  notes?: string;
};

export const presentRecommendationsTool = (): ChatTool<
  PresentRecommendationsInput,
  PresentRecommendationsResult
> => ({
  name: 'presentRecommendations',
  description: `Attach 1–${PRESENT_RECOMMENDATIONS_MAX} catalog card ids from this turn’s searchCards/getCard results. Honor the player’s requested count when they give one. Never invent ids.`,
  inputSchema: presentRecommendationsInputSchema,
  execute: async (input, ctx) => {
    const kept = allowlistCardIds(input.cardIds, ctx.retrievedCardIds, ctx.onUngrounded);
    if (kept.length === 0) {
      return {
        ok: false,
        code: 'ungrounded',
        message: 'No recommended ids were in this turn’s catalog results.',
      };
    }
    return { ok: true, data: { cardIds: kept, notes: input.notes } };
  },
});
