import { cn } from 'cn';
import { NavLink, useLocation } from 'react-router-dom';

import { Badge } from '@respark/ui/lib';

import { ADMIN_NAV, isNavPathActive, type AdminNavLeaf } from '@respark-admin/core/lib/nav';

const leafClass = (active: boolean) =>
  cn(
    'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
    active
      ? 'bg-muted font-medium text-foreground'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
  );

const NavLeaf = ({ item, pathname }: { item: AdminNavLeaf; pathname: string }) => {
  const active = isNavPathActive(pathname, item);
  const soon = item.comingSoon ? (
    <Badge variant="secondary" className="font-normal">
      Soon
    </Badge>
  ) : null;
  return (
    <NavLink to={item.to} className={leafClass(active)} aria-current={active ? 'page' : undefined}>
      <span>{item.label}</span>
      {soon}
    </NavLink>
  );
};

export const AdminNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Admin"
      className="w-full shrink-0 border-b bg-card px-3 py-3 md:w-56 md:min-h-0 md:overflow-y-auto md:border-r md:border-b-0"
    >
      <ul className="flex flex-col gap-4">
        {ADMIN_NAV.map((group) => (
          <li key={group.label}>
            {group.items ? (
              <div>
                <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLeaf item={item} pathname={pathname} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : group.to ? (
              <NavLeaf
                item={{
                  label: group.label,
                  to: group.to,
                  match: group.match,
                }}
                pathname={pathname}
              />
            ) : (
              <p className="px-2 text-sm font-medium">{group.label}</p>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};
