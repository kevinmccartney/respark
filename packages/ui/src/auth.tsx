import { useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

type GateProps = {
  children: ReactNode;
  redirectTo: string;
  fallbackClassName?: string;
};

export const RequireAuth = ({
  children,
  redirectTo,
  fallbackClassName = 'min-h-svh',
}: GateProps) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className={fallbackClassName} aria-live="polite" />;
  }

  if (!isSignedIn) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export const GuestOnly = ({ children, redirectTo, fallbackClassName = 'min-h-svh' }: GateProps) => {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className={fallbackClassName} aria-live="polite" />;
  }

  if (isSignedIn) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};
