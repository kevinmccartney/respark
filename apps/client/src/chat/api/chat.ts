import {
  CHAT_CONVERSATION_LIST_DEFAULT_LIMIT,
  chatConversationListResponseSchema,
  chatConversationResponseSchema,
  chatLatestResponseSchema,
  type ChatConversation,
  type ChatConversationSummary,
} from '@respark/schemas/chat';

import { apiFetchJson, type GetToken } from '@respark-client/core';

export type { ChatConversation, ChatConversationSummary };

export const fetchChatConversation = (
  getToken: GetToken,
  conversationId: string,
  init?: RequestInit,
): Promise<ChatConversation> =>
  apiFetchJson(
    `/chat/conversations/${conversationId}`,
    getToken,
    chatConversationResponseSchema,
    init,
  ).then((body) => body.conversation);

export const fetchLatestChatConversation = (
  getToken: GetToken,
  init?: RequestInit,
): Promise<ChatConversation | null> =>
  apiFetchJson(`/chat/conversations/latest`, getToken, chatLatestResponseSchema, init).then(
    (body) => body.conversation,
  );

export const fetchChatConversations = (
  getToken: GetToken,
  opts: { limit?: number } = {},
  init?: RequestInit,
): Promise<ChatConversationSummary[]> => {
  const params = new URLSearchParams();
  const limit = opts.limit ?? CHAT_CONVERSATION_LIST_DEFAULT_LIMIT;
  if (limit !== CHAT_CONVERSATION_LIST_DEFAULT_LIMIT) {
    params.set('limit', String(limit));
  }
  const qs = params.toString();
  return apiFetchJson(
    `/chat/conversations${qs ? `?${qs}` : ''}`,
    getToken,
    chatConversationListResponseSchema,
    init,
  ).then((body) => body.conversations);
};
