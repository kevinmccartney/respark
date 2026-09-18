import { useUser } from '@clerk/react'
import { SiteHeader } from '../components/SiteHeader.tsx'

export function HomePage() {
  const { user } = useUser()
  const firstName = user?.firstName?.trim()
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back'

  return (
    <>
      <SiteHeader />
      <main className="home-main">
        <h1>{greeting}</h1>
        <p className="home-subtitle">
          Your decks and card search will live here soon. For now, you&apos;re
          signed in and ready to go.
        </p>
      </main>
    </>
  )
}
