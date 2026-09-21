import { Show } from '@clerk/react';
import { Outlet } from 'react-router-dom';
import { ApiHealthFooter } from 'ui/health';
import { apiBaseUrl } from '../lib/api.ts';
import { AdminHeader } from './AdminHeader.tsx';
import { AdminNav } from './AdminNav.tsx';

export const AppShell = () => (
  <div className="flex min-h-svh flex-col bg-muted/40">
    <AdminHeader />
    <div className="flex flex-1 flex-col md:flex-row">
      <Show when="signed-in">
        <AdminNav />
      </Show>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
    <ApiHealthFooter apiBaseUrl={apiBaseUrl()} />
  </div>
);
