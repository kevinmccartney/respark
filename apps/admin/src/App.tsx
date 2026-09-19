import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.tsx';
import { GuestOnly, RequireAuth } from './components/AuthGate.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { SyncDetailPage } from './pages/SyncDetailPage.tsx';
import { SyncsListPage } from './pages/SyncsListPage.tsx';
import { SignInPage } from './pages/SignInPage.tsx';

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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
