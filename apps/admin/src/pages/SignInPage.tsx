import { SignInButton } from '@clerk/react'

export function SignInPage() {
  return (
    <main className="admin-main sign-in-main">
      <h1>Admin sign in</h1>
      <p className="muted">
        Sign in with a Clerk user that has{' '}
        <code>{`{ "role": "admin" }`}</code> in public metadata.
      </p>
      <SignInButton mode="modal">
        <button type="button" className="auth-button auth-button-primary">
          Sign in
        </button>
      </SignInButton>
    </main>
  )
}
