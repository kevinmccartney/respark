import type { ChatServerEvent, ChatVisibleMessage } from '@respark/schemas/chat';

import type { ChatLiveHandlers, LocalChatMessage } from '../types';

export const toLocalChatMessage = (message: ChatVisibleMessage): LocalChatMessage => ({
  id: message.id,
  role: message.role,
  parts: message.parts,
});

export const applyChatServerEvent = (event: ChatServerEvent, handlers: ChatLiveHandlers): void => {
  if (event.type === 'conversation') {
    handlers.setConversationId(event.conversationId);
    handlers.setDeck(event.deckId);
    handlers.setCard(event.cardId);
    return;
  }
  if (event.type === 'status') {
    handlers.setStatus(event.code);
    return;
  }
  if (event.type === 'text') {
    handlers.setStreamingText((current) => current + event.delta);
    return;
  }
  if (event.type === 'part') {
    if (event.part.type === 'card' || event.part.type === 'card-list') return;
    handlers.setStreamingParts((current) => [...current, event.part]);
    return;
  }
  if (event.type === 'error') {
    handlers.setError(event.message);
    handlers.setStatus(null);
    handlers.setStreamingText(() => '');
    handlers.setStreamingParts(() => []);
    handlers.setBusy(false);
    return;
  }
  if (event.type === 'done') {
    handlers.setDeck(event.deckId);
    handlers.setCard(event.cardId);
    handlers.setMessages((current) => [
      ...current,
      { id: event.messageId, role: 'assistant', parts: event.parts },
    ]);
    handlers.setStreamingText(() => '');
    handlers.setStreamingParts(() => []);
    handlers.setStatus(null);
    handlers.setBusy(false);
  }
};
