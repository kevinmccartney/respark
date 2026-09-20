import { useAuth } from '@clerk/react';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import {
  chatViewFromLocation,
  type ChatPart,
  type ChatServerEvent,
  type ChatStatusCode,
  type ChatVisibleMessage,
} from 'schemas/chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatCardPart } from './ChatCardPart.tsx';
import { ChatMarkdown } from './ChatMarkdown.tsx';
import { fetchChatConversation, fetchLatestChatConversation } from '../lib/chat.ts';
import { useChatSession } from '../lib/chat-session.tsx';
import { connectChatWs } from '../lib/chat-ws.ts';
import { ApiError, isAbortError, isNotFound } from '../lib/api.ts';

const DECK_PROMPT = 'What would be a good add to this deck?';
const CATALOG_PROMPT = 'Suggest some cards';

const STATUS_LABEL: Record<ChatStatusCode, string> = {
  thinking: 'Thinking',
  listDecks: 'Listing decks',
  getDeck: 'Reading deck',
  searchCards: 'Searching catalog',
  getCard: 'Looking up card',
  presentRecommendations: 'Picking cards',
};

type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: ChatPart[];
};

export const GlobalChat = () => {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);
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
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<ChatStatusCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingParts, setStreamingParts] = useState<ChatPart[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const sendRef = useRef<ReturnType<typeof connectChatWs>['send'] | null>(null);
  const pendingSend = useRef<Parameters<ReturnType<typeof connectChatWs>['send']>[0] | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const loadGen = useRef(0);
  const prompt = deckId ? DECK_PROMPT : CATALOG_PROMPT;

  const initialConversationId = useRef(conversationId);

  useEffect(() => {
    const gen = loadGen.current;
    const controller = new AbortController();
    const load = async () => {
      try {
        const storedId = initialConversationId.current;
        const token = () => getTokenRef.current();
        const loaded = storedId
          ? await fetchChatConversation(token, storedId, { signal: controller.signal })
          : await fetchLatestChatConversation(token, { signal: controller.signal });
        if (controller.signal.aborted || loadGen.current !== gen) return;
        if (loaded) {
          setConversationId(loaded.id);
          hydrateDeck(loaded.deckId);
          hydrateCard(loaded.cardId);
          setMessages(loaded.messages.map(toLocal));
        }
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted || loadGen.current !== gen) return;
        if (isNotFound(err)) {
          resetConversation();
          return;
        }
        if (err instanceof ApiError) setError(err.message);
      } finally {
        if (!controller.signal.aborted && loadGen.current === gen) setReady(true);
      }
    };
    void load();
    return () => controller.abort();
  }, [hydrateCard, hydrateDeck, resetConversation, setConversationId]);

  useEffect(() => {
    const ws = connectChatWs(() => getTokenRef.current(), {
      onEvent: (event) =>
        handleEvent(
          event,
          setConversationId,
          setDeck,
          setCard,
          setMessages,
          setStatus,
          setError,
          setStreamingText,
          setStreamingParts,
          setBusy,
        ),
    });
    sendRef.current = ws.send;
    if (pendingSend.current) {
      ws.send(pendingSend.current);
      pendingSend.current = null;
    }
    return () => {
      sendRef.current = null;
      ws.close();
    };
  }, [setConversationId, setDeck, setCard]);

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
    const payload = {
      conversationId,
      message,
      context: { deckId, cardId, view },
    };
    if (sendRef.current) sendRef.current(payload);
    else pendingSend.current = payload;
    setDraft('');
    if (!isOpen) setOpen(true);
  };

  const newConversation = () => {
    loadGen.current += 1;
    pendingSend.current = null;
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

        {status && busy ? <Badge variant="secondary">{STATUS_LABEL[status]}</Badge> : null}
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

const toLocal = (message: ChatVisibleMessage): LocalMessage => ({
  id: message.id,
  role: message.role,
  parts: message.parts,
});

const ChatBubble = ({ message }: { message: LocalMessage }) => (
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
  if (part.type === 'text') {
    return <ChatMarkdown text={part.text} />;
  }
  if (part.type === 'card') {
    return <ChatCardPart cardIds={[part.cardId]} />;
  }
  return <ChatCardPart cardIds={part.cardIds} />;
};

const handleEvent = (
  event: ChatServerEvent,
  setConversationId: (id: string | undefined) => void,
  setDeck: (deckId: string | null) => void,
  setCard: (cardId: string | null) => void,
  setMessages: Dispatch<SetStateAction<LocalMessage[]>>,
  setStatus: (code: ChatStatusCode | null) => void,
  setError: (message: string | null) => void,
  setStreamingText: Dispatch<SetStateAction<string>>,
  setStreamingParts: Dispatch<SetStateAction<ChatPart[]>>,
  setBusy: (busy: boolean) => void,
) => {
  if (event.type === 'conversation') {
    setConversationId(event.conversationId);
    setDeck(event.deckId);
    setCard(event.cardId);
    return;
  }
  if (event.type === 'status') {
    setStatus(event.code);
    return;
  }
  if (event.type === 'text') {
    setStreamingText((current) => current + event.delta);
    return;
  }
  if (event.type === 'part') {
    setStreamingParts((current) => [...current, event.part]);
    return;
  }
  if (event.type === 'error') {
    setError(event.message);
    setStatus(null);
    setStreamingText('');
    setStreamingParts([]);
    setBusy(false);
    return;
  }
  if (event.type === 'done') {
    setDeck(event.deckId);
    setCard(event.cardId);
    setMessages((current) => [
      ...current,
      { id: event.messageId, role: 'assistant', parts: event.parts },
    ]);
    setStreamingText('');
    setStreamingParts([]);
    setStatus(null);
    setBusy(false);
  }
};
