import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { CHAT_SESSION_STORAGE_KEY } from '../constants';

type StoredSession = {
  conversationId?: string;
  open?: boolean;
};

type ChatSessionValue = {
  conversationId: string | undefined;
  deckId: string | null;
  cardId: string | null;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  setConversationId: (id: string | undefined) => void;
  setDeck: (deckId: string | null) => void;
  setCard: (cardId: string | null) => void;
  hydrateDeck: (deckId: string | null) => void;
  hydrateCard: (cardId: string | null) => void;
  resetConversation: () => void;
};

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

const readSession = (): StoredSession => {
  try {
    const raw = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (!raw) return {};
    if (!raw.startsWith('{')) return { conversationId: raw };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const row = parsed as Record<string, unknown>;
    return {
      conversationId: typeof row.conversationId === 'string' ? row.conversationId : undefined,
      open: row.open === true,
    };
  } catch {
    return {};
  }
};

const writeSession = (session: StoredSession) => {
  try {
    if (!session.conversationId && !session.open) {
      sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
};

export const ChatSessionProvider = ({ children }: { children: ReactNode }) => {
  const [conversationId, setConversationId] = useState<string | undefined>(
    () => readSession().conversationId,
  );
  const [deckId, setDeckId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(() => readSession().open === true);
  const deckTouchedRef = useRef(false);
  const cardTouchedRef = useRef(false);

  useEffect(() => {
    writeSession({
      conversationId,
      open: isOpen || undefined,
    });
  }, [conversationId, isOpen]);

  const applyDeck = useCallback((nextDeckId: string | null) => {
    setDeckId(nextDeckId);
  }, []);

  const setDeck = useCallback(
    (nextDeckId: string | null) => {
      deckTouchedRef.current = true;
      applyDeck(nextDeckId);
    },
    [applyDeck],
  );

  const applyCard = useCallback((nextCardId: string | null) => {
    setCardId(nextCardId);
  }, []);

  const setCard = useCallback(
    (nextCardId: string | null) => {
      cardTouchedRef.current = true;
      applyCard(nextCardId);
    },
    [applyCard],
  );

  const hydrateDeck = useCallback(
    (nextDeckId: string | null) => {
      if (deckTouchedRef.current) return;
      applyDeck(nextDeckId);
    },
    [applyDeck],
  );

  const hydrateCard = useCallback(
    (nextCardId: string | null) => {
      if (cardTouchedRef.current) return;
      applyCard(nextCardId);
    },
    [applyCard],
  );

  const resetConversation = useCallback(() => {
    deckTouchedRef.current = true;
    cardTouchedRef.current = true;
    setConversationId(undefined);
    applyDeck(null);
    applyCard(null);
  }, [applyDeck, applyCard]);

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
};

export const useChatSession = (): ChatSessionValue => {
  const value = useContext(ChatSessionContext);
  if (!value) throw new Error('useChatSession requires ChatSessionProvider');
  return value;
};
