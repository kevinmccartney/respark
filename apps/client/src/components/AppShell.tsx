import { Show } from '@clerk/react';
import { Outlet } from 'react-router-dom';
import { ApiHealthFooter } from './ApiHealthFooter.tsx';
import { GlobalChat } from './GlobalChat.tsx';
import { SiteHeader } from './SiteHeader.tsx';
import { ChatSessionProvider } from '../lib/chat-session.tsx';

export const AppShell = () => (
  <ChatSessionProvider>
    <div className="flex h-svh overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
          <ApiHealthFooter />
        </div>
      </div>
      <Show when="signed-in">
        <GlobalChat />
      </Show>
    </div>
  </ChatSessionProvider>
);
