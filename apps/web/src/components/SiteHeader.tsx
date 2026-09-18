import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { Link } from 'react-router-dom'

type SiteHeaderProps = {
  showAuthActions?: boolean
}

export function SiteHeader({ showAuthActions = true }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <Link to="/" className="site-brand">
        respark
      </Link>
      {showAuthActions ? (
        <nav className="site-auth" aria-label="Account">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button type="button" className="auth-button">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="auth-button auth-button-primary">
                Sign up
              </button>
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
