import { Outlet } from 'react-router-dom'
import { ApiHealthFooter } from './ApiHealthFooter.tsx'

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-shell-body">
        <Outlet />
      </div>
      <ApiHealthFooter />
    </div>
  )
}
