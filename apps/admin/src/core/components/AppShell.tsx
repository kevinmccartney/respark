import { Show } from '@clerk/react';
import { Outlet } from 'react-router-dom';

import { ApiHealthFooter } from '@respark/ui';

import { AdminHeader, AdminNav } from '@respark-admin/core/components';
import { apiBaseUrl } from '@respark-admin/core/lib/api';

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
