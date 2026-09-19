import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

type SiteHeaderProps = {
  showAuthActions?: boolean
}

export function SiteHeader({ showAuthActions = true }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
      <div className="flex items-center gap-4">
        <Show when="signed-in">
          <Link to="/home" className="font-heading text-base font-semibold tracking-tight">
            respark
          </Link>
          <nav className="flex items-center gap-3" aria-label="Primary">
            <Link
              to="/search"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Search
            </Link>
            <Link
              to="/home"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Decks
            </Link>
          </nav>
        </Show>
        <Show when="signed-out">
          <Link to="/" className="font-heading text-base font-semibold tracking-tight">
            respark
          </Link>
        </Show>
      </div>
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
