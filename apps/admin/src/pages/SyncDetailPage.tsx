import { Link, useParams } from 'react-router-dom';
import { JobErrorsSection } from '@/components/JobErrorsSection.tsx';
import { JobReconciliationSection } from '@/components/JobReconciliationSection.tsx';
import { JobUnmatchedSection } from '@/components/JobUnmatchedSection.tsx';
import { LiveLogPanel } from '@/components/LiveLogPanel.tsx';
import { SyncJobList } from '@/components/SyncJobList.tsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { useSyncDetail } from '@/hooks/useSyncDetail.ts';
import { NotFoundPage } from '@/pages/NotFoundPage.tsx';
import {
  formatDuration,
  formatProgressPercent,
  formatTimestamp,
  statusBadgeProps,
} from '@/lib/format.ts';
import { JOB_LABELS, syncDurationMs, syncStagesLabel } from '@/lib/syncs.ts';

export const SyncDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const detail = useSyncDetail(id);

  const runningJob = detail.sync?.stages
    .flatMap((stage) => stage.jobs)
    .find((job) => job.status === 'running');
  const runningProgress = runningJob
    ? `${JOB_LABELS[runningJob.job] ?? runningJob.job} ${formatProgressPercent(
        detail.progressByJobId[runningJob.id]?.percent ?? null,
      )}`
    : null;

  if (detail.notFound) {
    return (
      <NotFoundPage
        title="Sync not found"
        description="That sync id doesn’t match a pipeline run."
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>Syncs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Sync detail</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {detail.loading ? <p className="text-muted-foreground">Loading…</p> : null}
      {detail.error ? (
        <Alert variant={detail.forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{detail.error}</AlertDescription>
        </Alert>
      ) : null}

      {detail.sync ? (
        <>
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl tracking-tight">
                {syncStagesLabel(detail.sync)}
              </h1>
              <Badge {...statusBadgeProps(detail.sync.status)}>{detail.sync.status}</Badge>
              {detail.live ? <span className="text-xs text-emerald-700">live</span> : null}
              {runningProgress ? (
                <span className="text-xs text-muted-foreground">{runningProgress}</span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{detail.sync.id}</p>
          </header>

          <Card className="mb-5">
            <CardContent>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-3">
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Started</dt>
                  <dd>{formatTimestamp(detail.sync.startedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Completed</dt>
                  <dd>{formatTimestamp(detail.sync.completedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Duration</dt>
                  <dd>{formatDuration(syncDurationMs(detail.sync))}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {detail.sync.errorMessage ? (
            <section className="mt-6" aria-label="Sync error">
              <Alert variant="destructive" className="mb-2">
                <AlertTitle>Sync error</AlertTitle>
                <AlertDescription>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-4 text-xs text-foreground whitespace-pre-wrap break-words">
                    {detail.sync.errorMessage}
                  </pre>
                </AlertDescription>
              </Alert>
            </section>
          ) : null}

          <LiveLogPanel logs={detail.liveLogs} />

          <SyncJobList
            sync={detail.sync}
            selectedJobId={detail.selectedJobId}
            progressByJobId={detail.progressByJobId}
            onSelect={(job) => void detail.selectJob(job)}
          />

          {detail.selectedJob?.job === 'identifiers' && detail.reconciliation ? (
            <JobReconciliationSection reconciliation={detail.reconciliation} />
          ) : null}

          {detail.selectedJob?.job === 'identifiers' && detail.reconciliation ? (
            <JobUnmatchedSection
              unmatched={detail.unmatched}
              total={detail.totalUnmatched}
              offset={detail.unmatchedOffset}
              loading={detail.unmatchedLoading}
              onPage={(next) => void detail.loadUnmatchedPage(next)}
            />
          ) : null}

          {detail.selectedJob ? (
            <JobErrorsSection
              job={detail.selectedJob}
              errors={detail.errors}
              total={detail.totalErrors}
              offset={detail.offset}
              loading={detail.errorsLoading}
              expandedPayload={detail.expandedPayload}
              payloadRow={detail.payloadRow}
              onExpand={detail.setExpandedPayload}
              onPage={(next) => void detail.loadErrorPage(next)}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
};
