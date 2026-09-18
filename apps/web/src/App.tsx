import { Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAuth } from './components/AuthGate.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { WelcomePage } from './pages/WelcomePage.tsx'

export default function App() {
  return (
    <Routes>
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
    </Routes>
  )
}
