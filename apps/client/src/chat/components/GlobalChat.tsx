import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { chatViewFromLocation, type ChatPart, type ChatStatusCode } from '@respark/schemas/chat';
import { Badge, Button, Input } from '@respark/ui/lib';

import { ApiError, isNotFound } from '@respark-client/core';

import { CATALOG_CHAT_PROMPT, CHAT_STATUS_LABEL, DECK_CHAT_PROMPT } from '../constants';
import { useChatConversation, useChatLive, useChatSession } from '../hooks';
import { toLocalChatMessage } from '../lib/chat-events';
import type { LocalChatMessage } from '../types';

import { ChatMarkdown } from './ChatMarkdown';

export const GlobalChat = () => {
  const { pathname, search } = useLocation();
  const view = chatViewFromLocation(pathname, search);
  const {
    conversationId,
    deckId,
    cardId,
    isOpen,
    setOpen,
    setConversationId,
    setDeck,
    setCard,
    hydrateDeck,
    hydrateCard,
    resetConversation,
  } = useChatSession();

  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ChatStatusCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingParts, setStreamingParts] = useState<ChatPart[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const loadGen = useRef(0);
  const prompt = deckId ? DECK_CHAT_PROMPT : CATALOG_CHAT_PROMPT;

  // Freeze the hydrate target at mount so later setConversationId does not retarget the query.
  const [hydrateConversationId] = useState(conversationId);
  const conversationQuery = useChatConversation(hydrateConversationId);

  const liveHandlers = useMemo(
    () => ({
      setConversationId,
      setDeck,
      setCard,
      setMessages: (updater: (current: LocalChatMessage[]) => LocalChatMessage[]) => {
        setMessages(updater);
      },
      setStatus,
      setError,
      setStreamingText: (updater: (current: string) => string) => {
        setStreamingText(updater);
      },
      setStreamingParts: (updater: (current: ChatPart[]) => ChatPart[]) => {
        setStreamingParts(updater);
      },
      setBusy,
    }),
    [setCard, setConversationId, setDeck],
  );

  const { send, clearPending } = useChatLive(liveHandlers);

  useEffect(() => {
    const gen = loadGen.current;
    if (conversationQuery.isPending) return;
    if (conversationQuery.isError) {
      if (loadGen.current !== gen) return;
      if (isNotFound(conversationQuery.error)) {
        resetConversation();
        setReady(true);
        return;
      }
      if (conversationQuery.error instanceof ApiError) setError(conversationQuery.error.message);
      setReady(true);
      return;
    }
    const loaded = conversationQuery.data;
    if (loadGen.current !== gen) return;
    if (loaded) {
      setConversationId(loaded.id);
      hydrateDeck(loaded.deckId);
      hydrateCard(loaded.cardId);
      setMessages(loaded.messages.map(toLocalChatMessage));
    }
    setReady(true);
  }, [
    conversationQuery.data,
    conversationQuery.error,
    conversationQuery.isError,
    conversationQuery.isPending,
    hydrateCard,
    hydrateDeck,
    resetConversation,
    setConversationId,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streamingText, streamingParts, status]);

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || busy || !ready) return;
    setError(null);
    setBusy(true);
    setStatus('thinking');
    setStreamingText('');
    setStreamingParts([]);
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: message }] },
    ]);
    send({
      conversationId,
      message,
      context: { deckId, cardId, view },
    });
    setDraft('');
    if (!isOpen) setOpen(true);
  };

  const newConversation = () => {
    loadGen.current += 1;
    clearPending();
    resetConversation();
    setMessages([]);
    setStreamingText('');
    setStreamingParts([]);
    setStatus(null);
    setError(null);
    setBusy(false);
    setReady(true);
  };

  if (!isOpen) return null;

  return (
    <aside
      id="global-chat-drawer"
      className="flex h-full w-[min(100vw,24rem)] shrink-0 flex-col overflow-hidden border-l border-border bg-card"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg">Chat</h2>
          <Button type="button" variant="ghost" size="sm" onClick={newConversation}>
            New
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {busy && (streamingText || streamingParts.length > 0) ? (
            <ChatBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                parts: [
                  ...(streamingText ? ([{ type: 'text', text: streamingText }] as ChatPart[]) : []),
                  ...streamingParts,
                ],
              }}
            />
          ) : null}
          <div ref={bottomRef} />
        </div>

        {status && busy ? <Badge variant="secondary">{CHAT_STATUS_LABEL[status]}</Badge> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !ready}
          onClick={() => submit(prompt)}
        >
          {prompt}
        </Button>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={deckId ? 'Ask about this deck…' : 'Ask about cards…'}
            disabled={busy || !ready}
            aria-label="Chat message"
          />
          <Button type="submit" disabled={busy || !ready || !draft.trim()}>
            Send
          </Button>
        </form>
      </div>
    </aside>
  );
};

const ChatBubble = ({ message }: { message: LocalChatMessage }) => (
  <div className={message.role === 'user' ? 'ml-6' : 'mr-6'}>
    <p className="mb-1 text-xs font-medium text-muted-foreground">
      {message.role === 'user' ? 'You' : 'Respark'}
    </p>
    <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
      {message.parts.map((part, index) => (
        <ChatPartView key={`${message.id}-${index}`} part={part} />
      ))}
    </div>
  </div>
);

const ChatPartView = ({ part }: { part: ChatPart }) => {
  if (part.type !== 'text') return null;
  return <ChatMarkdown text={part.text} />;
};
