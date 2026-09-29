import { useClerk, useUser } from '@clerk/react';
import { cn } from 'cn';
import { ChevronDown, Menu } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@respark/ui/lib';
import { ThemeToggle } from '@respark/ui/theme';

type NavItem = {
  label: string;
  to: string;
  /** Path prefixes that count as this item being active. */
  match: string[];
};

type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  { label: 'Play', items: [{ label: 'Life tracker', to: '/life', match: ['/life'] }] },
  { label: 'Brew', items: [{ label: 'Decks', to: '/home', match: ['/home', '/decks'] }] },
  { label: 'Catalog', items: [{ label: 'Cards', to: '/search', match: ['/search', '/cards'] }] },
];

const isItemActive = (item: NavItem, pathname: string) =>
  item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const isSectionActive = (section: NavSection, pathname: string) =>
  section.items.some((item) => isItemActive(item, pathname));

export const DesktopNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {NAV_SECTIONS.map((section) => (
        <DropdownMenu key={section.label}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'text-sm text-muted-foreground hover:text-foreground',
                  isSectionActive(section, pathname) && 'text-foreground',
                )}
              />
            }
          >
            {section.label}
            <ChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto min-w-40">
            {section.items.map((item) => (
              <DropdownMenuItem
                key={item.to}
                render={<Link to={item.to} />}
                className={cn('text-sm', isItemActive(item, pathname) && 'font-medium')}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </nav>
  );
};

export const MobileNav = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <Menu />
      </DialogTrigger>
      <DialogContent className="inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-6 overflow-y-auto rounded-none p-5 sm:max-w-none data-open:slide-in-from-right data-closed:slide-out-to-right">
        <DialogTitle className="font-heading text-base font-semibold tracking-tight text-chart-1">
          respark
        </DialogTitle>
        <nav className="flex flex-1 flex-col gap-5" aria-label="Primary">
          {NAV_SECTIONS.map((section) => (
            <section key={section.label} className="flex flex-col gap-1">
              <h2 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {section.label}
              </h2>
              {section.items.map((item) => {
                const active = isItemActive(item, pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted',
                      active && 'bg-muted font-medium',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
        <MobileAccount onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
};

const MobileAccount = ({ onNavigate }: { onNavigate: () => void }) => {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress;
  const displayName = user?.fullName || user?.username || email;

  return (
    <section aria-label="Account" className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="size-9 shrink-0 rounded-full" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {email && email !== displayName ? (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </div>
        <ThemeToggle />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            onNavigate();
            openUserProfile();
          }}
        >
          Manage account
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </section>
  );
};
