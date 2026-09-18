import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

type SiteHeaderProps = {
  showAuthActions?: boolean
}

export function SiteHeader({ showAuthActions = true }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
      <Link to="/" className="font-heading text-base font-semibold tracking-tight">
        respark
      </Link>
      {showAuthActions ? (
        <nav className="flex items-center gap-2" aria-label="Account">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button type="button" variant="outline">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button type="button">Sign up</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      ) : null}
    </header>
  )
}
