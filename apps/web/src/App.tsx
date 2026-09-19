import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { GuestOnly, RequireAuth } from './components/AuthGate.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { CardDetailPage } from './pages/CardDetailPage.tsx'
import { DeckDetailPage } from './pages/DeckDetailPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NewDeckPage } from './pages/NewDeckPage.tsx'
import { SearchPage } from './pages/SearchPage.tsx'
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
      </Route>
    </Routes>
  )
}
