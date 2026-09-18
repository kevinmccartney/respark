import { SignInButton, SignUpButton } from '@clerk/react'

export function WelcomePage() {
  return (
    <div className="welcome">
      <div className="welcome-glow" aria-hidden />
      <section className="welcome-content">
        <p className="welcome-eyebrow">Magic: The Gathering companion</p>
        <h1 className="welcome-title">Respark your deck building</h1>
        <p className="welcome-lead">
          Learn cards, refine your lists, and build decks with a companion built
          for the long game—not just the next brew night.
        </p>
        <div className="welcome-actions">
          <SignUpButton mode="modal">
            <button type="button" className="auth-button auth-button-primary welcome-cta">
              Get started
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button type="button" className="auth-button welcome-cta-secondary">
              I already have an account
            </button>
          </SignInButton>
        </div>
      </section>
    </div>
  )
}
