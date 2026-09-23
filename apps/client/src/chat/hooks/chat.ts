import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchChatConversation,
  fetchChatConversations,
  fetchLatestChatConversation,
} from '../api/chat';

export const chatKeys = {
  all: ['chat'] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  latest: () => [...chatKeys.all, 'latest'] as const,
  list: (limit?: number) => [...chatKeys.all, 'list', limit ?? 'default'] as const,
};

export const useChatConversation = (conversationId: string | undefined) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: conversationId ? chatKeys.conversation(conversationId) : chatKeys.latest(),
    queryFn: ({ signal }) =>
      conversationId
        ? fetchChatConversation(getToken, conversationId, { signal })
        : fetchLatestChatConversation(getToken, { signal }),
  });
};

export const useChatConversations = (limit?: number) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: chatKeys.list(limit),
    queryFn: ({ signal }) => fetchChatConversations(getToken, { limit }, { signal }),
  });
};
