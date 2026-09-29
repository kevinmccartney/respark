import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@respark/ui/lib';
import { ThemeToggle } from '@respark/ui/theme';

import { DesktopNav, MobileNav } from './PrimaryNav';

type SiteHeaderProps = {
  showAuthActions?: boolean;
  headerExtra?: ReactNode;
};

export const SiteHeader = ({ showAuthActions = true, headerExtra }: SiteHeaderProps) => (
  <header className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
    <div className="flex items-center gap-2 md:gap-4">
      <Show when="signed-in">
        <Link to="/" className="font-heading text-base font-semibold tracking-tight text-chart-1">
          respark
        </Link>
        <DesktopNav />
      </Show>
      <Show when="signed-out">
        <Link to="/" className="font-heading text-base font-semibold tracking-tight text-secondary">
          respark
        </Link>
      </Show>
    </div>
    <div className="flex items-center gap-2">
      {headerExtra}
      <Show when="signed-out">
        <ThemeToggle />
        {showAuthActions ? (
          <nav className="flex items-center gap-2" aria-label="Account">
            <SignInButton mode="modal">
              <Button type="button" variant="outline">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button type="button">Sign up</Button>
            </SignUpButton>
          </nav>
        ) : null}
      </Show>
      <Show when="signed-in">
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {showAuthActions ? (
            <nav className="flex items-center gap-2" aria-label="Account">
              <UserButton />
            </nav>
          ) : null}
        </div>
        <MobileNav />
      </Show>
    </div>
  </header>
);
