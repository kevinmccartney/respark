import type { ChatPart } from 'schemas/chat';
import { CHAT_HISTORY_LIMIT } from './chat.constants';

export const selectHistoryMessages = <T extends { role: string }>(
  messages: T[],
  limit = CHAT_HISTORY_LIMIT,
): T[] =>
  messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-limit);

export const textFromParts = (parts: ChatPart[]): string =>
  parts
    .filter((part): part is Extract<ChatPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
