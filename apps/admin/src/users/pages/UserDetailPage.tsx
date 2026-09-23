import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { clerkUserIdSchema, type AdminUser } from '@respark/schemas';
import { Badge } from '@respark/ui/lib';

import { DetailShell } from '@respark-admin/core/components';
import { adminQueryErrorState } from '@respark-admin/core/lib';
import { useUser } from '@respark-admin/users/hooks';
import { formatUserName } from '@respark-admin/users/lib/format';

export const UserDetailPage = () => {
  const { clerkUserId = '' } = useParams<{ clerkUserId: string }>();
  const validId = clerkUserIdSchema.safeParse(clerkUserId).success;
  const { data: user, isPending, error } = useUser(clerkUserId);
  const { notFound } = adminQueryErrorState(error, 'Could not load user');

  return (
    <DetailShell
      maxWidth="5xl"
      notFound={
        !validId || notFound
          ? {
              title: 'User not found',
              description: 'That Clerk user is not in this instance.',
            }
          : null
      }
      error={error}
      errorFallback="Could not load user"
      loading={isPending && !user}
      loadingLabel="Loading user…"
    >
      {user ? <UserDetailBody user={user} /> : null}
    </DetailShell>
  );
};

const UserDetailBody = ({ user }: { user: AdminUser }) => (
  <div className="space-y-6">
    <header className="flex flex-wrap items-start gap-4">
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt=""
          className="size-16 rounded-full bg-muted object-cover ring-1 ring-foreground/10"
        />
      ) : (
        <div className="size-16 rounded-full bg-muted ring-1 ring-foreground/10" />
      )}
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-heading text-2xl font-semibold">{formatUserName(user)}</h1>
          {user.role === 'admin' ? <Badge variant="secondary">Admin</Badge> : null}
          {user.banned ? <Badge variant="destructive">Banned</Badge> : null}
          {user.locked ? <Badge variant="outline">Locked</Badge> : null}
          {user.deletedAt ? <Badge variant="outline">Deleted locally</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">{user.email ?? 'No primary email'}</p>
      </div>
    </header>

    <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <DetailRow label="Clerk id">
        <span className="break-all font-mono text-xs">{user.clerkUserId}</span>
      </DetailRow>
      <DetailRow label="Local id">
        {user.localUserId ? (
          <span className="break-all font-mono text-xs">{user.localUserId}</span>
        ) : (
          <span className="text-muted-foreground">Not synced yet</span>
        )}
      </DetailRow>
      <DetailRow label="First name">{user.firstName ?? '—'}</DetailRow>
      <DetailRow label="Last name">{user.lastName ?? '—'}</DetailRow>
      <DetailRow label="Created">{formatDateTime(user.createdAt)}</DetailRow>
      <DetailRow label="Updated">{formatDateTime(user.updatedAt)}</DetailRow>
      <DetailRow label="Last sign-in">{formatDateTime(user.lastSignInAt)}</DetailRow>
      <DetailRow label="Last active">{formatDateTime(user.lastActiveAt)}</DetailRow>
      <DetailRow label="Local deleted">
        {user.deletedAt ? formatDateTime(user.deletedAt) : '—'}
      </DetailRow>
    </dl>

    <p className="text-sm text-muted-foreground">
      Role changes are managed in{' '}
      <Link
        to="https://dashboard.clerk.com"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        Clerk Dashboard
      </Link>{' '}
      via <code className="text-xs">publicMetadata.role</code>.
    </p>
  </div>
);

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd>{children}</dd>
  </>
);

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};
