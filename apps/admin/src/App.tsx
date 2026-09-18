import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { GuestOnly, RequireAuth } from './components/AuthGate.tsx'
import { RunDetailPage } from './pages/RunDetailPage.tsx'
import { RunsListPage } from './pages/RunsListPage.tsx'
import { SignInPage } from './pages/SignInPage.tsx'

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
              <RunsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/runs/:id"
          element={
            <RequireAuth>
              <RunDetailPage />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  )
}
