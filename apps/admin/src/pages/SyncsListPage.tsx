import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { applyAdminLoadError, apiErrorMessage } from '@/lib/errors.ts';
import { connectEtlSyncWs } from '@/lib/etl-ws.ts';
import { formatDuration, formatTimestamp, statusBadgeProps } from '@/lib/format.ts';
import type { EtlSync } from 'schemas/etl-sync';
import type { SyncEvent } from 'schemas/sync-event';
import { patchSyncInList, upsertStartedSync } from '@/lib/sync-state.ts';
import { fetchEtlSyncs, startEtlSync, syncDurationMs, syncStagesLabel } from '@/lib/syncs.ts';

export const SyncsListPage = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [syncs, setSyncs] = useState<EtlSync[]>([]);
  const [progressBySync, setProgressBySync] = useState<
    Record<string, { percent: number | null; job: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [includeCatalog, setIncludeCatalog] = useState(true);
  const [includeEnrichment, setIncludeEnrichment] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const enrichmentOnly = includeEnrichment && !includeCatalog;

  const loadSyncs = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
        setForbidden(false);
      }
      try {
        const list = await fetchEtlSyncs(getToken, { limit: 100 });
        if (!signal?.aborted) setSyncs(list);
      } catch (err) {
        if (signal?.aborted) return;
        applyAdminLoadError(err, { setError, setForbidden }, 'Could not load ETL syncs');
      } finally {
        if (!signal?.aborted && !silent) setLoading(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSyncs(controller.signal);
    return () => controller.abort();
  }, [loadSyncs]);

  useEffect(() => {
    if (forbidden) return;

    const applyEvent = (event: SyncEvent) => {
      if (event.type === 'sync.started') {
        setSyncs((prev) => upsertStartedSync(prev, event));
        return;
      }

      if (event.type === 'sync.updated' || event.type === 'sync.completed') {
        setSyncs((prev) => patchSyncInList(prev, event));
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
  }, [getToken, forbidden]);

  const onStartSync = async () => {
    if (!includeCatalog && !includeEnrichment) {
      setStartMessage('Select Catalog and/or Enrichment');
      return;
    }
    setStarting(true);
    setStartMessage(null);
    try {
      await startEtlSync(getToken, {
        catalog: includeCatalog,
        enrichmentJobs: includeEnrichment ? ['identifiers'] : [],
      });
      setStartMessage('Sync started — live updates will appear below.');
      void loadSyncs(undefined, true);
    } catch (err) {
      setStartMessage(apiErrorMessage(err, 'Could not start ETL sync'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
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
        <p className="mb-3 text-muted-foreground" role="status">
          {startMessage}
        </p>
      ) : null}

      {loading ? <p className="text-muted-foreground">Loading…</p> : null}
      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error ? (
        syncs.length === 0 ? (
          <p className="text-muted-foreground">No ETL syncs yet.</p>
        ) : (
          <div className="rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
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
                        {prog
                          ? prog.percent != null
                            ? `${prog.job} ${prog.percent}%`
                            : `${prog.job}…`
                          : '—'}
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
