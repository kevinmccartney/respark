import { useAuth } from '@clerk/react';
import { useEffect, useRef } from 'react';

import type { ChatSend } from '@respark/schemas/chat';

import { connectChatWs } from '../api/chat-ws';
import { applyChatServerEvent } from '../lib/chat-events';
import type { ChatLiveHandlers } from '../types';

export const useChatLive = (handlers: ChatLiveHandlers) => {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  const handlersRef = useRef(handlers);
  const sendRef = useRef<ReturnType<typeof connectChatWs>['send'] | null>(null);
  const pendingSend = useRef<ChatSend | null>(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const ws = connectChatWs(() => getTokenRef.current(), {
      onEvent: (event) => applyChatServerEvent(event, handlersRef.current),
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
  }, []);

  return {
    send: (payload: ChatSend) => {
      if (sendRef.current) sendRef.current(payload);
      else pendingSend.current = payload;
    },
    clearPending: () => {
      pendingSend.current = null;
    },
  };
};
