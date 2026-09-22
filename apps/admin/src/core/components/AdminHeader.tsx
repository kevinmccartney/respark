import { Show, SignInButton, UserButton } from '@clerk/react';
import { Link } from 'react-router-dom';

import { Button } from '@respark/ui/lib';

import { ThemeToggle } from './ThemeToggle';

export const AdminHeader = () => (
  <header className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
    <div className="flex items-center gap-4">
      <Show when="signed-in">
        <Link to="/" className="font-heading text-base font-semibold tracking-tight">
          respark admin
        </Link>
      </Show>
      <Show when="signed-out">
        <span className="font-heading text-base font-semibold tracking-tight">respark admin</span>
      </Show>
    </div>
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <nav className="flex items-center gap-2" aria-label="Account">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button type="button" variant="outline">
              Sign in
            </Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
    </div>
  </header>
);
