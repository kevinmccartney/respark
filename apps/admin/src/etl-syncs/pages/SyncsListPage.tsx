import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { EtlSync } from '@respark/schemas';
import type { SyncEvent } from '@respark/schemas/sync-event';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@respark/ui/lib';

import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import { adminQueryErrorState, apiErrorMessage } from '@respark-admin/core/lib';

import { connectEtlSyncWs } from '../api';
import { etlSyncKeys, useEtlSyncs, useStartEtlSync } from '../hooks';
import {
  formatDuration,
  formatTimestamp,
  patchSyncInList,
  statusBadgeProps,
  syncDurationMs,
  syncListProgressLabel,
  syncStagesLabel,
  upsertStartedSync,
} from '../lib';

const LIST_OPTS = { limit: 100 } as const;

export const SyncsListPage = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: syncs = [], isPending, error } = useEtlSyncs(LIST_OPTS);
  const startSync = useStartEtlSync();
  const { forbidden } = adminQueryErrorState(error, 'Could not load ETL syncs');

  const [progressBySync, setProgressBySync] = useState<
    Record<string, { percent: number | null; job: string }>
  >({});
  const [includeCatalog, setIncludeCatalog] = useState(true);
  const [includeEnrichment, setIncludeEnrichment] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const enrichmentOnly = includeEnrichment && !includeCatalog;
  const starting = startSync.isPending;

  useEffect(() => {
    if (forbidden) return;

    const applyEvent = (event: SyncEvent) => {
      if (event.type === 'sync.started') {
        queryClient.setQueryData<EtlSync[]>(etlSyncKeys.list(LIST_OPTS), (prev) =>
          prev ? upsertStartedSync(prev, event) : prev,
        );
        return;
      }

      if (event.type === 'sync.updated' || event.type === 'sync.completed') {
        queryClient.setQueryData<EtlSync[]>(etlSyncKeys.list(LIST_OPTS), (prev) =>
          prev ? patchSyncInList(prev, event) : prev,
        );
        if (event.type === 'sync.completed') {
          setProgressBySync((prev) => {
            const next = { ...prev };
            delete next[event.syncId];
            return next;
          });
        }
        return;
      }

      if (event.type === 'job.progress') {
        setProgressBySync((prev) => ({
          ...prev,
          [event.syncId]: {
            percent: event.progress.percent,
            job: event.job,
          },
        }));
      }
    };

    const ws = connectEtlSyncWs(getToken, {
      onOpen: () => {
        setLive(true);
        ws.subscribeList();
      },
      onClose: () => setLive(false),
      onEvent: applyEvent,
    });

    return () => ws.close();
  }, [getToken, forbidden, queryClient]);

  const onStartSync = async () => {
    if (!includeCatalog && !includeEnrichment) {
      setStartMessage('Select Catalog and/or Enrichment');
      return;
    }
    setStartMessage(null);
    try {
      await startSync.mutateAsync({
        catalog: includeCatalog,
        enrichmentJobs: includeEnrichment ? ['identifiers'] : [],
      });
      setStartMessage('Sync started — live updates will appear below.');
    } catch (err) {
      setStartMessage(apiErrorMessage(err, 'Could not start ETL sync'));
    }
  };

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-5 py-5">
      <header className="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">ETL syncs</h1>
          <p className="mt-1 text-muted-foreground">
            Pipeline executions (catalog + enrichment stages)
            {live ? <span className="ml-2 text-xs text-emerald-700">· live</span> : null}
          </p>
        </div>
        <form
          className="flex flex-col items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void onStartSync();
          }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeCatalog}
                disabled={starting || forbidden}
                onChange={(e) => setIncludeCatalog(e.target.checked)}
              />
              Catalog
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeEnrichment}
                disabled={starting || forbidden}
                onChange={(e) => setIncludeEnrichment(e.target.checked)}
              />
              Enrichment
            </label>
            <Button type="submit" disabled={starting || forbidden}>
              {starting ? 'Starting…' : 'Start sync'}
            </Button>
          </div>
          {enrichmentOnly ? (
            <Alert className="max-w-md">
              <AlertDescription>
                Enrichment requires an existing catalog. Prefer running Catalog first or select
                both.
              </AlertDescription>
            </Alert>
          ) : null}
        </form>
      </header>

      {startMessage ? (
        <p className="mb-3 shrink-0 text-muted-foreground" role="status">
          {startMessage}
        </p>
      ) : null}

      {isPending ? <p className="shrink-0 text-muted-foreground">Loading…</p> : null}
      <div className="shrink-0">
        <AdminLoadErrorAlert error={error} fallback="Could not load ETL syncs" />
      </div>

      {!isPending && !error ? (
        syncs.length === 0 ? (
          <p className="shrink-0 text-muted-foreground">No ETL syncs yet.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <Table containerClassName="min-h-0 flex-1 overflow-auto">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_0_var(--border)]">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Status</TableHead>
                  <TableHead>Stages</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncs.map((sync) => {
                  const prog = progressBySync[sync.id];
                  return (
                    <TableRow
                      key={sync.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="link"
                      onClick={() => navigate(`/syncs/${sync.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/syncs/${sync.id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <Badge {...statusBadgeProps(sync.status)}>{sync.status}</Badge>
                      </TableCell>
                      <TableCell>{syncStagesLabel(sync)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {syncListProgressLabel(sync, prog)}
                      </TableCell>
                      <TableCell>{formatTimestamp(sync.startedAt)}</TableCell>
                      <TableCell>{formatDuration(syncDurationMs(sync))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      ) : null}
    </main>
  );
};
