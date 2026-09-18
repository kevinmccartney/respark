import { Outlet } from 'react-router-dom'
import { ApiHealthFooter } from './ApiHealthFooter.tsx'

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <ApiHealthFooter />
    </div>
  )
}
