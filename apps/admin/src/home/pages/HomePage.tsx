import { useUser } from '@clerk/react';
import { Link } from 'react-router-dom';

import type { EtlSync } from '@respark/schemas';
import { Badge, Button } from '@respark/ui/lib';

import { useSearchCards } from '@respark-admin/cards';
import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import {
  formatDuration,
  formatTimestamp,
  statusBadgeProps,
  syncDurationMs,
  syncStagesLabel,
  useEtlSyncs,
} from '@respark-admin/etl-syncs';
import { useSearchSets } from '@respark-admin/sets';
import { useSearchUsers } from '@respark-admin/users';

const COUNT_OPTS = { limit: 1 } as const;
const RECENT_SYNC_OPTS = { limit: 5 } as const;

type StatCardProps = {
  label: string;
  to: string;
  total: number | undefined;
  loading: boolean;
  error: unknown;
};

const StatCard = ({ label, to, total, loading, error }: StatCardProps) => (
  <Link
    to={to}
    className="flex flex-col gap-1 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
  >
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-heading text-3xl tabular-nums">
      {error ? '—' : loading ? '…' : (total ?? 0).toLocaleString()}
    </span>
  </Link>
);

const Stats = () => {
  const cards = useSearchCards(COUNT_OPTS);
  const sets = useSearchSets(COUNT_OPTS);
  const users = useSearchUsers(COUNT_OPTS);
  const error = cards.error ?? sets.error ?? users.error;

  return (
    <section aria-label="Totals" className="flex flex-col gap-3">
      <AdminLoadErrorAlert error={error} fallback="Could not load totals" />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Cards"
          to="/catalog/cards"
          total={cards.data?.total}
          loading={cards.isPending}
          error={cards.error}
        />
        <StatCard
          label="Sets"
          to="/catalog/sets"
          total={sets.data?.total}
          loading={sets.isPending}
          error={sets.error}
        />
        <StatCard
          label="Users"
          to="/users/management"
          total={users.data?.total}
          loading={users.isPending}
          error={users.error}
        />
      </div>
    </section>
  );
};

const SyncStatusBadge = ({ sync }: { sync: EtlSync }) => (
  <Badge {...statusBadgeProps(sync.status)}>{sync.status}</Badge>
);

const LatestSync = ({ sync }: { sync: EtlSync }) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Latest sync</h3>
        <SyncStatusBadge sync={sync} />
      </div>
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<Link to={`/etl-syncs/${sync.id}`} />}
      >
        View details
      </Button>
    </div>
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Stages</dt>
        <dd>{syncStagesLabel(sync)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Started</dt>
        <dd>{formatTimestamp(sync.startedAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Duration</dt>
        <dd>{formatDuration(syncDurationMs(sync))}</dd>
      </div>
    </dl>
    {sync.errorMessage ? <p className="text-sm text-destructive">{sync.errorMessage}</p> : null}
  </div>
);

const RecentSyncs = ({ syncs }: { syncs: EtlSync[] }) => (
  <ul className="flex flex-col divide-y rounded-lg border bg-card">
    {syncs.map((sync) => (
      <li key={sync.id}>
        <Link
          to={`/etl-syncs/${sync.id}`}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            <SyncStatusBadge sync={sync} />
            <span>{syncStagesLabel(sync)}</span>
          </span>
          <span className="text-muted-foreground">
            {formatTimestamp(sync.startedAt)} · {formatDuration(syncDurationMs(sync))}
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

const Syncs = () => {
  const { data: syncs = [], isPending, error } = useEtlSyncs(RECENT_SYNC_OPTS);
  const [latest] = syncs;

  return (
    <section aria-labelledby="syncs-heading" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4">
        <h2 id="syncs-heading" className="font-heading text-xl tracking-tight">
          ETL syncs
        </h2>
        <Link to="/etl-syncs" className="text-sm text-muted-foreground hover:text-foreground">
          View all syncs
        </Link>
      </header>

      {error ? (
        <AdminLoadErrorAlert error={error} fallback="Could not load ETL syncs" />
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !latest ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">No syncs yet.</p>
          <Button size="sm" nativeButton={false} render={<Link to="/etl-syncs" />}>
            Start a sync
          </Button>
        </div>
      ) : (
        <>
          <LatestSync sync={latest} />
          <RecentSyncs syncs={syncs} />
        </>
      )}
    </section>
  );
};

export const HomePage = () => {
  const { user } = useUser();
  const firstName = user?.firstName?.trim();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8">
      <h1 className="font-heading text-3xl tracking-tight">
        {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
      </h1>
      <Stats />
      <Syncs />
    </main>
  );
};
