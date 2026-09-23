import { Show } from '@clerk/react';
import { Outlet } from 'react-router-dom';

import { ApiHealthFooter } from '@respark/ui';

import { AdminHeader, AdminNav } from '@respark-admin/core/components';
import { apiBaseUrl } from '@respark-admin/core/lib/api';

export const AppShell = () => (
  <div className="flex h-svh max-h-svh flex-col overflow-hidden bg-muted/40">
    <div className="shrink-0">
      <AdminHeader />
    </div>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Show when="signed-in">
        <AdminNav />
      </Show>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
    <div className="shrink-0">
      <ApiHealthFooter apiBaseUrl={apiBaseUrl()} />
    </div>
  </div>
);
