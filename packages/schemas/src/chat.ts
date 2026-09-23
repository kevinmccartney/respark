import { z } from 'zod';

import { CARD_SEARCH_SCRYFALL_QUERY_MAX, cardSearchSortSchema } from './cards.js';
import { colorIdentitySchema, deckFormatSchema } from './decks.js';
import { isoDateTimeSchema, uuidSchema } from './primitives.js';

export const SEARCH_CARDS_TOOL_DEFAULT_LIMIT = 25;
export const SEARCH_CARDS_TOOL_DEFAULT_SORT = 'edhrecRank' as const;
export const SEARCH_CARDS_TOOL_MAX_LIMIT = 50;
export const EXCLUDE_CARD_IDS_MAX = 400;
export const PRESENT_RECOMMENDATIONS_MAX = 25;
export const LOOKUP_COMBOS_INCLUDED_CAP = 8;
export const LOOKUP_COMBOS_ALMOST_CAP = 8;
export const LOOKUP_COMBOS_QUERY_CAP = 8;
export const LOOKUP_COMBOS_DESCRIPTION_MAX = 400;
export const LOOKUP_COMBOS_QUERY_MAX = 200;

export const chatViewAreaSchema = z.enum(['home', 'search', 'card', 'deck', 'new-deck', 'other']);

export type ChatViewArea = z.infer<typeof chatViewAreaSchema>;

export const chatViewSchema = z
  .object({
    area: chatViewAreaSchema,
    deckId: uuidSchema.optional(),
    cardId: uuidSchema.optional(),
    scryfall: z.string().trim().min(1).max(CARD_SEARCH_SCRYFALL_QUERY_MAX).optional(),
  })
  .strict();

export type ChatView = z.infer<typeof chatViewSchema>;

export const chatViewFromLocation = (pathname: string, search = ''): ChatView => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const scryfallRaw = params.get('scryfall')?.trim();
  const scryfall = scryfallRaw ? scryfallRaw.slice(0, CARD_SEARCH_SCRYFALL_QUERY_MAX) : undefined;
  if (pathname === '/home') return { area: 'home' };
  if (pathname === '/search') return scryfall ? { area: 'search', scryfall } : { area: 'search' };
  if (pathname === '/decks/new') return { area: 'new-deck' };
  const deckMatch = /^\/decks\/([^/]+)$/.exec(pathname);
  if (deckMatch?.[1] && uuidSchema.safeParse(deckMatch[1]).success) {
    return { area: 'deck', deckId: deckMatch[1] };
  }
  const cardMatch = /^\/cards\/([^/]+)$/.exec(pathname);
  if (cardMatch?.[1] && uuidSchema.safeParse(cardMatch[1]).success) {
    return { area: 'card', cardId: cardMatch[1] };
  }
  return { area: 'other' };
};

export const chatSendSchema = z
  .object({
    conversationId: uuidSchema.optional(),
    message: z.string().trim().min(1).max(4000),
    context: z
      .object({
        deckId: uuidSchema.nullish(),
        cardId: uuidSchema.nullish(),
        view: chatViewSchema.optional(),
      })
      .strict()
      .optional()
      .default({}),
  })
  .strict();

export type ChatSend = z.infer<typeof chatSendSchema>;

export const chatTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const chatCardPartSchema = z.object({
  type: z.literal('card'),
  cardId: uuidSchema,
});

export const chatCardListPartSchema = z.object({
  type: z.literal('card-list'),
  cardIds: z.array(uuidSchema).min(1).max(PRESENT_RECOMMENDATIONS_MAX),
});

export const chatPartSchema = z.discriminatedUnion('type', [
  chatTextPartSchema,
  chatCardPartSchema,
  chatCardListPartSchema,
]);

export type ChatPart = z.infer<typeof chatPartSchema>;

export const chatStatusCodeSchema = z.enum([
  'thinking',
  'listDecks',
  'getDeck',
  'searchCards',
  'getCard',
  'lookupCombos',
  'presentRecommendations',
]);

export type ChatStatusCode = z.infer<typeof chatStatusCodeSchema>;

export const chatConversationEventSchema = z.object({
  type: z.literal('conversation'),
  conversationId: uuidSchema,
  deckId: uuidSchema.nullable(),
  cardId: uuidSchema.nullable(),
});

export const chatStatusEventSchema = z.object({
  type: z.literal('status'),
  code: chatStatusCodeSchema,
});

export const chatTextEventSchema = z.object({
  type: z.literal('text'),
  delta: z.string(),
});

export const chatPartEventSchema = z.object({
  type: z.literal('part'),
  part: chatPartSchema,
});

export const chatErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const chatDoneEventSchema = z.object({
  type: z.literal('done'),
  messageId: uuidSchema,
  parts: z.array(chatPartSchema),
  deckId: uuidSchema.nullable(),
  cardId: uuidSchema.nullable(),
});

export const chatServerEventSchema = z.discriminatedUnion('type', [
  chatConversationEventSchema,
  chatStatusEventSchema,
  chatTextEventSchema,
  chatPartEventSchema,
  chatErrorEventSchema,
  chatDoneEventSchema,
]);

export type ChatServerEvent = z.infer<typeof chatServerEventSchema>;

export const chatWsEnvelopeSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('ready'),
    data: z.object({ ok: z.literal(true) }),
  }),
  z.object({
    event: z.literal('chat'),
    data: chatServerEventSchema,
  }),
]);

export type ChatWsEnvelope = z.infer<typeof chatWsEnvelopeSchema>;

export const chatMessageRoleSchema = z.enum(['user', 'assistant', 'tool']);

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatVisibleMessageSchema = z.object({
  id: uuidSchema,
  role: z.enum(['user', 'assistant']),
  parts: z.array(chatPartSchema),
  createdAt: isoDateTimeSchema,
});

export type ChatVisibleMessage = z.infer<typeof chatVisibleMessageSchema>;

export const chatConversationSchema = z.object({
  id: uuidSchema,
  deckId: uuidSchema.nullable(),
  cardId: uuidSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  messages: z.array(chatVisibleMessageSchema),
});

export type ChatConversation = z.infer<typeof chatConversationSchema>;

export const chatConversationResponseSchema = z.object({
  conversation: chatConversationSchema,
});

export type ChatConversationResponse = z.infer<typeof chatConversationResponseSchema>;

export const chatLatestResponseSchema = z.object({
  conversation: chatConversationSchema.nullable(),
});

export type ChatLatestResponse = z.infer<typeof chatLatestResponseSchema>;

export const getDeckInputSchema = z
  .object({
    deckId: uuidSchema.optional(),
  })
  .strict();

export type GetDeckInput = z.infer<typeof getDeckInputSchema>;

export const compactDeckCommanderSchema = z.object({
  printingId: uuidSchema,
  cardId: uuidSchema,
  name: z.string(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  keywords: z.array(z.string()).nullable(),
});

export const compactDeckLineSchema = z.object({
  cardId: uuidSchema,
  name: z.string(),
  typeLine: z.string().nullable(),
  manaValue: z.string().nullable(),
  colorIdentity: colorIdentitySchema,
  keywords: z.array(z.string()).nullable(),
  quantity: z.number().int(),
  sideboard: z.boolean(),
});

export const compactDeckStatsSchema = z.object({
  typeCounts: z.record(z.string(), z.number()),
  manaCurve: z.record(z.string(), z.number()),
  keywordCounts: z.record(z.string(), z.number()),
});

export const compactDeckSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  format: deckFormatSchema,
  colorIdentity: colorIdentitySchema,
  commander: compactDeckCommanderSchema.nullable(),
  cardCount: z.number().int(),
  stats: compactDeckStatsSchema,
  lines: z.array(compactDeckLineSchema),
  truncated: z.boolean(),
});

export type CompactDeck = z.infer<typeof compactDeckSchema>;

export const listDecksInputSchema = z.object({}).strict();

export type ListDecksInput = z.infer<typeof listDecksInputSchema>;

export const compactDeckListItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  format: deckFormatSchema,
  colorIdentity: colorIdentitySchema,
});

export const listDecksResultSchema = z.object({
  decks: z.array(compactDeckListItemSchema),
});

export type ListDecksResult = z.infer<typeof listDecksResultSchema>;

export const searchCardsInputSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    scryfall: z.string().trim().min(1).max(CARD_SEARCH_SCRYFALL_QUERY_MAX).optional(),
    colorIdentity: colorIdentitySchema.optional(),
    legalIn: deckFormatSchema.optional(),
    typeContains: z.string().trim().min(1).max(80).optional(),
    maxManaValue: z.number().int().min(0).max(20).optional(),
    excludeCardIds: z.array(uuidSchema).max(EXCLUDE_CARD_IDS_MAX).optional(),
    sort: cardSearchSortSchema.optional(),
    limit: z.number().int().min(1).max(SEARCH_CARDS_TOOL_MAX_LIMIT).optional(),
  })
  .strict();

export type SearchCardsInput = z.infer<typeof searchCardsInputSchema>;

export const getCardInputSchema = z
  .object({
    cardId: uuidSchema,
  })
  .strict();

export type GetCardInput = z.infer<typeof getCardInputSchema>;

export const lookupCombosInputSchema = z
  .object({
    q: z.string().trim().max(LOOKUP_COMBOS_QUERY_MAX).optional(),
    deckId: uuidSchema.optional(),
  })
  .strict();

export type LookupCombosInput = z.infer<typeof lookupCombosInputSchema>;

export const lookupCombosCardSchema = z.object({
  name: z.string(),
  catalogId: uuidSchema.nullable(),
  inDeck: z.boolean(),
});

export const lookupCombosComboSchema = z.object({
  id: z.string(),
  produces: z.array(z.string()),
  uses: z.array(lookupCombosCardSchema),
  missing: z.array(lookupCombosCardSchema),
  manaNeeded: z.string().nullable(),
  description: z.string().nullable(),
  popularity: z.number().nullable(),
  bracketTag: z.string().nullable(),
  url: z.string(),
});

export const lookupCombosResultSchema = z.object({
  mode: z.enum(['deck', 'query']),
  included: z.array(lookupCombosComboSchema).optional(),
  almostIncluded: z.array(lookupCombosComboSchema).optional(),
  variants: z.array(lookupCombosComboSchema).optional(),
  source: z.object({
    name: z.literal('Commander Spellbook'),
    url: z.string(),
  }),
});

export type LookupCombosResult = z.infer<typeof lookupCombosResultSchema>;

export const presentRecommendationsInputSchema = z
  .object({
    cardIds: z.array(uuidSchema).min(1).max(PRESENT_RECOMMENDATIONS_MAX),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export type PresentRecommendationsInput = z.infer<typeof presentRecommendationsInputSchema>;

export const toolErrorSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string(),
});

export const toolOkSchema = <S extends z.ZodType>(dataSchema: S) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export type ToolError = z.infer<typeof toolErrorSchema>;
export type ToolResult<T> = { ok: true; data: T } | ToolError;
