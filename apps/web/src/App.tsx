import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { GuestOnly, RequireAuth } from './components/AuthGate.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NewDeckPage } from './pages/NewDeckPage.tsx'
import { WelcomePage } from './pages/WelcomePage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="/"
          element={
            <GuestOnly>
              <SiteHeader />
              <WelcomePage />
            </GuestOnly>
          }
        />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
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
      </Route>
    </Routes>
  )
}
