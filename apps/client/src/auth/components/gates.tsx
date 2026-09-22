import type { ReactNode } from 'react';

import { GuestOnly as UiGuestOnly, RequireAuth as UiRequireAuth } from '@respark/ui/auth';

export const RequireAuth = ({ children }: { children: ReactNode }) => (
  <UiRequireAuth redirectTo="/" fallbackClassName="min-h-svh">
    {children}
  </UiRequireAuth>
);

export const GuestOnly = ({ children }: { children: ReactNode }) => (
  <UiGuestOnly redirectTo="/home" fallbackClassName="min-h-svh">
    {children}
  </UiGuestOnly>
);
