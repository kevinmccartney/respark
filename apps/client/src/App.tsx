import { Show } from '@clerk/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { GuestOnly, RequireAuth } from '@respark-client/auth';
import { CardDetailPage, SearchPage } from '@respark-client/cards';
import { ChatSessionProvider, ChatToggle, GlobalChat } from '@respark-client/chat';
import { AppShell, NotFoundPage, WelcomePage, type AppRouteHandle } from '@respark-client/core';
import { DeckDetailPage, DeckListPage, NewDeckPage } from '@respark-client/decks';

const searchHandle = { hasPagination: true } satisfies AppRouteHandle;

const RootLayout = () => (
  <ChatSessionProvider>
    <AppShell
      rail={
        <Show when="signed-in">
          <ChatToggle />
          <GlobalChat />
        </Show>
      }
    />
  </ChatSessionProvider>
);

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: (
          <GuestOnly>
            <WelcomePage />
          </GuestOnly>
        ),
      },
      {
        path: '/home',
        element: (
          <RequireAuth>
            <DeckListPage />
          </RequireAuth>
        ),
      },
      {
        path: '/search',
        handle: searchHandle,
        element: (
          <RequireAuth>
            <SearchPage />
          </RequireAuth>
        ),
      },
      {
        path: '/cards/:id',
        element: (
          <RequireAuth>
            <CardDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: '/decks/new',
        element: (
          <RequireAuth>
            <NewDeckPage />
          </RequireAuth>
        ),
      },
      {
        path: '/decks/:id',
        element: (
          <RequireAuth>
            <DeckDetailPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
