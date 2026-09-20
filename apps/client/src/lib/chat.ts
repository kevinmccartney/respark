import {
  chatConversationResponseSchema,
  chatLatestResponseSchema,
  type ChatConversation,
} from 'schemas/chat';
import { apiFetchJson, type GetToken } from './api.ts';

export type { ChatConversation };

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
  apiFetchJson(`/chat/conversations`, getToken, chatLatestResponseSchema, init).then(
    (body) => body.conversation,
  );
