import { useAuth } from '@clerk/react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="page-loading" aria-live="polite" />
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />
  }

  return children
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <div className="page-loading" aria-live="polite" />
  }

  if (isSignedIn) {
    return <Navigate to="/home" replace />
  }

  return children
}
