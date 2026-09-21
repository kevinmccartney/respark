export type AdminNavLeaf = {
  label: string;
  to: string;
  comingSoon?: boolean;
  match?: (pathname: string) => boolean;
};

export type AdminNavGroup = {
  label: string;
  to?: string;
  match?: (pathname: string) => boolean;
  items?: AdminNavLeaf[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Catalog',
    items: [
      { label: 'Cards', to: '/catalog/cards', comingSoon: true },
      { label: 'Sets', to: '/catalog/sets', comingSoon: true },
      {
        label: 'ETL Syncs',
        to: '/',
        match: (pathname) => pathname === '/' || pathname.startsWith('/syncs'),
      },
    ],
  },
  {
    label: 'Users',
    items: [{ label: 'Management', to: '/users/management', comingSoon: true }],
  },
  {
    label: 'Recommendations',
    items: [{ label: 'Goodstuff', to: '/recommendations/goodstuff' }],
  },
];

export const isNavPathActive = (
  pathname: string,
  item: { to?: string; match?: (pathname: string) => boolean },
): boolean => {
  if (item.match) return item.match(pathname);
  return Boolean(item.to && pathname === item.to);
};
