import { cn } from 'cn';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  Badge,
  Button,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useScrollVisibility,
} from '@respark/ui/lib';

import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import { useClampPageParam } from '@respark-admin/core/hooks';
import { parsePageParam, setPageParam } from '@respark-admin/core/lib';
import { USERS_LIST_PAGE_SIZE } from '@respark-admin/users/constants';
import { useSearchUsers } from '@respark-admin/users/hooks';
import { formatUserName } from '@respark-admin/users/lib/format';

export const UsersListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const pageParam = parsePageParam(searchParams);

  const [draftQ, setDraftQ] = useState(qParam);

  useEffect(() => {
    setDraftQ(qParam);
  }, [qParam]);

  const { data, isPending, isFetching, error } = useSearchUsers({
    q: qParam || undefined,
    limit: USERS_LIST_PAGE_SIZE,
    page: pageParam,
  });

  useClampPageParam(
    data ? { page: data.page, totalPages: data.totalPages } : undefined,
    pageParam,
    !isFetching,
  );

  const applyFilters = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams();
    const q = draftQ.trim();
    if (q) next.set('q', q);
    setSearchParams(next);
  };

  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    setPageParam(next, nextPage);
    setSearchParams(next);
  };

  const rows = data?.users ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? pageParam;
  const totalPages = data?.totalPages ?? 0;
  const loading = isPending || isFetching;
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const { visible: paginationVisible, ref: paginationRef } = useScrollVisibility(
    'show-on-scroll-down',
    { scrollerRef: tableScrollRef },
  );

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-5 py-5">
      <header className="mb-4 shrink-0">
        <h1 className="font-heading text-xl font-semibold">Users</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Clerk accounts for this instance. Role comes from{' '}
          <code className="text-xs">publicMetadata.role</code>.
        </p>
      </header>

      <div className="shrink-0">
        <AdminLoadErrorAlert error={error} fallback="Could not load users" />
      </div>

      <form
        className="mb-5 flex shrink-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-end"
        onSubmit={applyFilters}
      >
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          <span className="text-muted-foreground">Search</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            placeholder="Email, name, or Clerk id…"
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" disabled={loading}>
            Apply
          </Button>
        </div>
      </form>

      <p className="mb-2 shrink-0 text-sm text-muted-foreground" aria-live="polite">
        {isPending ? 'Loading…' : `${total.toLocaleString()} users`}
      </p>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table
          className="min-w-4xl"
          containerRef={tableScrollRef}
          containerClassName="min-h-0 flex-1 overflow-auto pb-14"
        >
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Clerk id</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => (
              <TableRow
                key={user.clerkUserId}
                className="cursor-pointer"
                onClick={() => navigate(`/users/management/${user.clerkUserId}`)}
              >
                <TableCell>
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt=""
                      className="size-8 rounded-full bg-muted object-cover"
                    />
                  ) : (
                    <div className="size-8 rounded-full bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    to={`/users/management/${user.clerkUserId}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {formatUserName(user)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {user.clerkUserId}
                </TableCell>
                <TableCell>
                  {user.role === 'admin' ? (
                    <Badge variant="secondary">Admin</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.banned ? <Badge variant="destructive">Banned</Badge> : null}
                    {user.locked ? <Badge variant="outline">Locked</Badge> : null}
                    {user.deletedAt ? <Badge variant="outline">Deleted locally</Badge> : null}
                    {!user.banned && !user.locked && !user.deletedAt ? (
                      <span className="text-muted-foreground">Active</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {!isPending && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No users match this search.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div
          ref={paginationRef}
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 px-2 py-1 backdrop-blur transition-transform duration-200 supports-backdrop-filter:bg-card/80',
            paginationVisible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
          )}
        >
          <Pagination
            page={page}
            totalPages={totalPages}
            disabled={loading}
            onPageChange={goToPage}
            className="mt-0"
          />
        </div>
      </div>
    </main>
  );
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
