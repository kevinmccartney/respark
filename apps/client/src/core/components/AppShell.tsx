import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { ApiHealthFooter } from '@respark/ui/health';

import { apiBaseUrl } from '../lib/api';

import { SiteHeader } from './SiteHeader';

type AppShellProps = {
  rail?: ReactNode;
  headerExtra?: ReactNode;
};

export const AppShell = ({ rail, headerExtra }: AppShellProps) => (
  <div className="flex h-svh overflow-hidden">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SiteHeader headerExtra={headerExtra} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <ApiHealthFooter apiBaseUrl={apiBaseUrl()} />
    </div>
    {rail}
  </div>
);
