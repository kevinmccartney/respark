import { Outlet } from 'react-router-dom'
import { AdminHeader } from './AdminHeader.tsx'

export function AppShell() {
  return (
    <div className="app-shell">
      <AdminHeader />
      <div className="app-shell-body">
        <Outlet />
      </div>
    </div>
  )
}
