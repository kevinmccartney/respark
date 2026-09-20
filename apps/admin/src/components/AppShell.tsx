import { Outlet } from 'react-router-dom';
import { AdminHeader } from './AdminHeader.tsx';
import { ApiHealthFooter } from './ApiHealthFooter.tsx';

export const AppShell = () => (
  <div className="flex min-h-svh flex-col bg-muted/40">
    <AdminHeader />
    <div className="flex-1">
      <Outlet />
    </div>
    <ApiHealthFooter />
  </div>
);
