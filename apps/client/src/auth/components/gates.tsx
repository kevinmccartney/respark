import type { ReactNode } from 'react';

import { RequireAuth as UiRequireAuth } from '@respark/ui/auth';

export const RequireAuth = ({ children }: { children: ReactNode }) => (
  <UiRequireAuth redirectTo="/" fallbackClassName="min-h-svh">
    {children}
  </UiRequireAuth>
);
