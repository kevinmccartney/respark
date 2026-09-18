import { Show, SignInButton, UserButton } from '@clerk/react'
import { Link } from 'react-router-dom'

export function AdminHeader() {
  return (
    <header className="admin-header">
      <div className="admin-header-brand">
        <Link to="/" className="admin-brand">
          respark admin
        </Link>
        <span className="admin-nav-label">ETL</span>
      </div>
      <nav className="admin-header-actions" aria-label="Account">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button type="button" className="auth-button">
              Sign in
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
    </header>
  )
}
