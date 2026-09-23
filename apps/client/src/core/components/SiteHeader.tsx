import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@respark/ui/lib';
import { ThemeToggle } from '@respark/ui/theme';

type SiteHeaderProps = {
  showAuthActions?: boolean;
  headerExtra?: ReactNode;
};

export const SiteHeader = ({ showAuthActions = true, headerExtra }: SiteHeaderProps) => (
  <header className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
    <div className="flex items-center gap-4">
      <Show when="signed-in">
        <Link
          to="/home"
          className="font-heading text-base font-semibold tracking-tight text-chart-1"
        >
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
        <Link to="/" className="font-heading text-base font-semibold tracking-tight text-secondary">
          respark
        </Link>
      </Show>
    </div>
    <div className="flex items-center gap-2">
      {headerExtra}
      <ThemeToggle />
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
    </div>
  </header>
);
