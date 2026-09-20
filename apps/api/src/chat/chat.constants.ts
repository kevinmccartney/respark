export const CHAT_MAX_ROUNDS = 16;
export const CHAT_MAX_TOOL_CALLS = 32;

export type ChatTurnStopReason =
  'completed' | 'max_tool_calls' | 'max_rounds' | 'timeout' | 'provider_error';

export const CHAT_ROUND_TIMEOUT_MS = 45_000;
export const CHAT_HISTORY_LIMIT = 12;
export const CHAT_GROUNDED_CARD_PROMPT_CAP = 80;
export const CHAT_DOWNWEIGHT_PROMPT_CAP = 40;
export const GET_DECK_LINE_CAP = 400;
export const GET_DECK_KEYWORD_COUNT_CAP = 12;
export const CHAT_WS_PATH = '/chat/ws';
export const CHAT_WS_PING_MS = 25_000;
export const CHAT_MAX_CONNECTIONS = 32;
export const CHAT_PROVIDER_TOKEN = Symbol('CHAT_PROVIDER');

export const WS_CLOSE = {
  unauthorized: 4401,
  tryAgain: 1013,
} as const;
