import type { ReactNode } from 'react';

import { GuestOnly as UiGuestOnly, RequireAuth as UiRequireAuth } from '@respark/ui/auth';

export const RequireAuth = ({ children }: { children: ReactNode }) => (
  <UiRequireAuth redirectTo="/sign-in" fallbackClassName="min-h-[40vh]">
    {children}
  </UiRequireAuth>
);

export const GuestOnly = ({ children }: { children: ReactNode }) => (
  <UiGuestOnly redirectTo="/" fallbackClassName="min-h-[40vh]">
    {children}
  </UiGuestOnly>
);
