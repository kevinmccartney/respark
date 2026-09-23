import type { ChatPart, ChatStatusCode } from '@respark/schemas/chat';

export type LocalChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatPart[];
};

export type ChatLiveHandlers = {
  setConversationId: (id: string | undefined) => void;
  setDeck: (deckId: string | null) => void;
  setCard: (cardId: string | null) => void;
  setMessages: (updater: (current: LocalChatMessage[]) => LocalChatMessage[]) => void;
  setStatus: (code: ChatStatusCode | null) => void;
  setError: (message: string | null) => void;
  setStreamingText: (updater: (current: string) => string) => void;
  setStreamingParts: (updater: (current: ChatPart[]) => ChatPart[]) => void;
  setBusy: (busy: boolean) => void;
};
