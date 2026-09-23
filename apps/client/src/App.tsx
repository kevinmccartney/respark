import { Show } from '@clerk/react';
import { Route, Routes } from 'react-router-dom';

import { GuestOnly, RequireAuth } from '@respark-client/auth';
import { CardDetailPage, SearchPage } from '@respark-client/cards';
import { ChatSessionProvider, ChatToggle, GlobalChat } from '@respark-client/chat';
import { AppShell, NotFoundPage, WelcomePage } from '@respark-client/core';
import { DeckDetailPage, DeckListPage, NewDeckPage } from '@respark-client/decks';

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
