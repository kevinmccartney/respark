import {
  PRESENT_RECOMMENDATIONS_MAX,
  presentRecommendationsInputSchema,
  type PresentRecommendationsInput,
} from '@respark/schemas/chat';

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
  description: `Commit 1–${PRESENT_RECOMMENDATIONS_MAX} catalog card ids from this turn's searchCards/getCard/lookupCombos results for your prose (including combo missing pieces). Do not commit getDeck line ids. Honor the player's requested count when they give one. Prefer cards that match the commander / keywordCounts. Do not commit an all-goodstuff slate when the same search had non-flagged hits, unless the player asked for that class. The UI does not attach images. Never invent ids.`,
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
