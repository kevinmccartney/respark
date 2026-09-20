import { Outlet } from 'react-router-dom';
import { ApiHealthFooter } from './ApiHealthFooter.tsx';
import { SiteHeader } from './SiteHeader.tsx';

export const AppShell = () => (
  <div className="flex min-h-svh flex-col">
    <SiteHeader />
    <div className="flex flex-1 flex-col">
      <Outlet />
    </div>
    <ApiHealthFooter />
  </div>
);
