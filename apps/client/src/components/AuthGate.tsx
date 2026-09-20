import { useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-svh" aria-live="polite" />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export const GuestOnly = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-svh" aria-live="polite" />;
  }

  if (isSignedIn) {
    return <Navigate to="/home" replace />;
  }

  return children;
};
