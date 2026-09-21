import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth, SignInPage } from '@/auth';
import { AppShell, ComingSoonPage, NotFoundPage } from '@/core';
import { SyncDetailPage, SyncsListPage } from '@/etl-syncs';
import { GoodstuffsPage } from '@/recommendations';

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
              <ComingSoonPage
                title="Cards"
                description="A table of catalog cards will live here."
              />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog/sets"
          element={
            <RequireAuth>
              <ComingSoonPage title="Sets" description="A table of catalog sets will live here." />
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
        <Route
          path="/recommendations/goodstuff"
          element={
            <RequireAuth>
              <GoodstuffsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
