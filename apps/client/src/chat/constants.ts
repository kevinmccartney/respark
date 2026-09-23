import type { ChatStatusCode } from '@respark/schemas/chat';

export const DECK_CHAT_PROMPT = 'What would be a good add to this deck?';
export const CATALOG_CHAT_PROMPT = 'Suggest some cards';

export const CHAT_STATUS_LABEL: Record<ChatStatusCode, string> = {
  thinking: 'Thinking',
  listDecks: 'Listing decks',
  getDeck: 'Reading deck',
  searchCards: 'Searching catalog',
  getCard: 'Looking up card',
  lookupCombos: 'Checking combos',
  presentRecommendations: 'Picking cards',
};

export const CHAT_SESSION_STORAGE_KEY = 'respark.chat';

export const CHAT_CARD_PATH =
  /^\/cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

export const CHAT_WS_RECONNECT_BASE_MS = 1000;
export const CHAT_WS_RECONNECT_MAX_MS = 30_000;
