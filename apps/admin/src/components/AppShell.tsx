import { Outlet } from 'react-router-dom';
import { AdminHeader } from './AdminHeader.tsx';

export const AppShell = () => (
  <div className="flex min-h-svh flex-col bg-muted/40">
    <AdminHeader />
    <div className="flex-1">
      <Outlet />
    </div>
  </div>
);
