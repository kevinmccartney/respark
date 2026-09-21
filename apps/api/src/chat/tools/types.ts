import type { ZodType } from 'zod';
import type { ToolResult } from 'schemas/chat';

export type ToolContext = {
  clerkUserId: string;
  deckId: string | null;
  cardId: string | null;
  retrievedCardIds: Set<string>;
  onUngrounded?: (cardId: string) => void;
};

export type ChatToolName =
  'listDecks' | 'getDeck' | 'searchCards' | 'getCard' | 'lookupCombos' | 'presentRecommendations';

export type ChatTool<I, O> = {
  name: ChatToolName;
  description: string;
  inputSchema: ZodType<I>;
  execute: (input: I, ctx: ToolContext) => Promise<ToolResult<O>>;
};
