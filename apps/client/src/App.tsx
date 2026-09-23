import { Show } from '@clerk/react';
import { Route, Routes } from 'react-router-dom';

import { GuestOnly, RequireAuth } from '@/auth';
import { CardDetailPage, SearchPage } from '@/cards';
import { ChatSessionProvider, ChatToggle, GlobalChat } from '@/chat';
import { AppShell, NotFoundPage, WelcomePage } from '@/core';
import { DeckDetailPage, DeckListPage, NewDeckPage } from '@/decks';

export default function App() {
  return (
    <ChatSessionProvider>
      <Routes>
        <Route
          element={
            <AppShell
              headerExtra={
                <Show when="signed-in">
                  <ChatToggle />
                </Show>
              }
              rail={
                <Show when="signed-in">
                  <GlobalChat />
                </Show>
              }
            />
          }
        >
          <Route
            path="/"
            element={
              <GuestOnly>
                <WelcomePage />
              </GuestOnly>
            }
          />
          <Route
            path="/home"
            element={
              <RequireAuth>
                <DeckListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/search"
            element={
              <RequireAuth>
                <SearchPage />
              </RequireAuth>
            }
          />
          <Route
            path="/cards/:id"
            element={
              <RequireAuth>
                <CardDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/decks/new"
            element={
              <RequireAuth>
                <NewDeckPage />
              </RequireAuth>
            }
          />
          <Route
            path="/decks/:id"
            element={
              <RequireAuth>
                <DeckDetailPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ChatSessionProvider>
  );
}
