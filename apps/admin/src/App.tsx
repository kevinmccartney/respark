import { Route, Routes } from 'react-router-dom';

import { GuestOnly, RequireAuth } from '@respark-admin/auth/components';
import { SignInPage } from '@respark-admin/auth/pages';
import { CardDetailPage, CardsListPage, GoodstuffsPage } from '@respark-admin/cards/pages';
import { AppShell } from '@respark-admin/core/components';
import { ComingSoonPage, NotFoundPage } from '@respark-admin/core/pages';
import { SyncDetailPage, SyncsListPage } from '@respark-admin/etl-syncs/pages';
import { SetDetailPage, SetsListPage } from '@respark-admin/sets/pages';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="/sign-in"
          element={
            <GuestOnly>
              <SignInPage />
            </GuestOnly>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <SyncsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/syncs/:id"
          element={
            <RequireAuth>
              <SyncDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog/cards"
          element={
            <RequireAuth>
              <CardsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog/cards/:id"
          element={
            <RequireAuth>
              <CardDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog/sets"
          element={
            <RequireAuth>
              <SetsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog/sets/:id"
          element={
            <RequireAuth>
              <SetDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog/goodstuff"
          element={
            <RequireAuth>
              <GoodstuffsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/users/management"
          element={
            <RequireAuth>
              <ComingSoonPage
                title="User management"
                description="Invite and manage admin users here."
              />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
