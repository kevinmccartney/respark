import { useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-[40vh]" aria-live="polite" />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
};

export const GuestOnly = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-[40vh]" aria-live="polite" />;
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
};
