import { Link, useParams } from 'react-router-dom';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Breadcrumb,
  BreadcrumbList,
  Badge,
  BreadcrumbItem,
  BreadcrumbLink,
  Card,
  CardContent,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@respark/ui/lib';

import { NotFoundPage } from '@respark-admin/core/pages';
import { JOB_LABELS } from '@respark-admin/etl-syncs/constants';

import {
  JobErrorsSection,
  JobReconciliationSection,
  JobUnmatchedSection,
  LiveLogPanel,
  SyncJobList,
} from '../components';
import { useSyncDetail } from '../hooks';
import {
  formatDuration,
  formatProgressPercent,
  formatTimestamp,
  statusBadgeProps,
  syncDurationMs,
  syncStagesLabel,
} from '../lib';

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
        description="That sync id doesn't match a pipeline run."
      />
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>ETL Syncs</BreadcrumbLink>
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
