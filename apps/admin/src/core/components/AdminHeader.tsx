import { Show, SignInButton, UserButton } from '@clerk/react';
import { Link } from 'react-router-dom';
import { Button } from '@/core/ui/button';
import { ThemeToggle } from './ThemeToggle.tsx';

export const AdminHeader = () => (
  <header className="flex items-center justify-between gap-4 border-b bg-card px-5 py-3">
    <div className="flex items-center gap-4">
      <Link to="/" className="font-heading text-base font-semibold tracking-tight">
        respark admin
      </Link>
      <nav className="flex items-center gap-3" aria-label="Primary">
        <Link
          to="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ETL
        </Link>
      </nav>
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
