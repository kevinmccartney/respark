import { Show, SignInButton, UserButton } from '@clerk/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function AdminHeader() {
  return (
    <header className="flex items-center justify-between gap-4 bg-zinc-950 px-5 py-3 text-zinc-50">
      <div className="flex items-baseline gap-3">
        <Link to="/" className="font-heading font-semibold tracking-tight">
          respark admin
        </Link>
        <span className="text-xs tracking-wider text-zinc-400 uppercase">ETL</span>
      </div>
      <nav className="flex items-center gap-2" aria-label="Account">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button type="button" variant="outline" className="bg-white text-zinc-950 hover:bg-zinc-100">
              Sign in
            </Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
    </header>
  )
}
