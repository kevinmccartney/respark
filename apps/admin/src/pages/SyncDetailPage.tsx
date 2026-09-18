import { useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '../lib/api.ts'
import {
  formatDuration,
  formatNumber,
  formatTimestamp,
  statusBadgeProps,
} from '../lib/format.ts'
import {
  fetchEtlSync,
  fetchJobErrors,
  fetchJobReconciliation,
  fetchJobUnmatched,
  isForbidden,
  JOB_LABELS,
  STAGE_LABELS,
  syncDurationMs,
  syncStagesLabel,
  type EtlJobRun,
  type EtlSync,
  type IngestionError,
  type IngestionReconciliation,
  type IngestionUnmatched,
} from '../lib/syncs.ts'

const PAGE_SIZE = 50

export function SyncDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  const [sync, setSync] = useState<EtlSync | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [reconciliation, setReconciliation] =
    useState<IngestionReconciliation | null>(null)
  const [unmatched, setUnmatched] = useState<IngestionUnmatched[]>([])
  const [totalUnmatched, setTotalUnmatched] = useState(0)
  const [unmatchedOffset, setUnmatchedOffset] = useState(0)
  const [unmatchedLoading, setUnmatchedLoading] = useState(false)
  const [errors, setErrors] = useState<IngestionError[]>([])
  const [totalErrors, setTotalErrors] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorsLoading, setErrorsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [expandedPayload, setExpandedPayload] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      setForbidden(false)
      setOffset(0)
      setUnmatchedOffset(0)
      try {
        const syncRow = await fetchEtlSync(getToken, id!)
        if (controller.signal.aborted) return
        setSync(syncRow)

        const allJobs = syncRow.stages.flatMap((s) => s.jobs)
        const preferred =
          allJobs.find((j) => j.job === 'identifiers') ?? allJobs[0] ?? null
        const jobId = preferred?.id ?? null
        setSelectedJobId(jobId)

        if (jobId) {
          const [errorPage, recon, unmatchedPage] = await Promise.all([
            fetchJobErrors(getToken, id!, jobId, {
              limit: PAGE_SIZE,
              offset: 0,
            }),
            preferred?.job === 'identifiers'
              ? fetchJobReconciliation(getToken, id!, jobId)
              : Promise.resolve(null),
            preferred?.job === 'identifiers'
              ? fetchJobUnmatched(getToken, id!, jobId, {
                  limit: PAGE_SIZE,
                  offset: 0,
                })
              : Promise.resolve({ unmatched: [], total: 0 }),
          ])
          if (controller.signal.aborted) return
          setErrors(errorPage.errors)
          setTotalErrors(errorPage.total)
          setReconciliation(recon)
          setUnmatched(unmatchedPage.unmatched)
          setTotalUnmatched(unmatchedPage.total)
        } else {
          setErrors([])
          setTotalErrors(0)
          setReconciliation(null)
          setUnmatched([])
          setTotalUnmatched(0)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        if (isForbidden(err)) {
          setForbidden(true)
          setError(
            'Your account is not an admin. Set publicMetadata.role to "admin" in Clerk.',
          )
        } else if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('Could not load sync')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [getToken, id])

  async function selectJob(job: EtlJobRun) {
    if (!id) return
    setSelectedJobId(job.id)
    setErrorsLoading(true)
    setUnmatchedLoading(true)
    setOffset(0)
    setUnmatchedOffset(0)
    setExpandedPayload(null)
    try {
      const [errorPage, recon, unmatchedPage] = await Promise.all([
        fetchJobErrors(getToken, id, job.id, { limit: PAGE_SIZE, offset: 0 }),
        job.job === 'identifiers'
          ? fetchJobReconciliation(getToken, id, job.id)
          : Promise.resolve(null),
        job.job === 'identifiers'
          ? fetchJobUnmatched(getToken, id, job.id, {
              limit: PAGE_SIZE,
              offset: 0,
            })
          : Promise.resolve({ unmatched: [], total: 0 }),
      ])
      setErrors(errorPage.errors)
      setTotalErrors(errorPage.total)
      setReconciliation(recon)
      setUnmatched(unmatchedPage.unmatched)
      setTotalUnmatched(unmatchedPage.total)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Could not load job details')
    } finally {
      setErrorsLoading(false)
      setUnmatchedLoading(false)
    }
  }

  async function loadErrorPage(nextOffset: number) {
    if (!id || !selectedJobId) return
    setErrorsLoading(true)
    try {
      const errorPage = await fetchJobErrors(getToken, id, selectedJobId, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setErrors(errorPage.errors)
      setTotalErrors(errorPage.total)
      setOffset(nextOffset)
      setExpandedPayload(null)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Could not load failed rows')
    } finally {
      setErrorsLoading(false)
    }
  }

  async function loadUnmatchedPage(nextOffset: number) {
    if (!id || !selectedJobId) return
    setUnmatchedLoading(true)
    try {
      const page = await fetchJobUnmatched(getToken, id, selectedJobId, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      })
      setUnmatched(page.unmatched)
      setTotalUnmatched(page.total)
      setUnmatchedOffset(nextOffset)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Could not load unmatched records')
    } finally {
      setUnmatchedLoading(false)
    }
  }

  const selectedJob =
    sync?.stages
      .flatMap((s) => s.jobs)
      .find((j) => j.id === selectedJobId) ?? null

  const payloadRow =
    expandedPayload == null
      ? null
      : (errors.find((e) => e.id === expandedPayload) ?? null)

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

      {loading ? <p className="text-muted-foreground">Loading…</p> : null}
      {error ? (
        <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {sync ? (
        <>
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl tracking-tight">
                {syncStagesLabel(sync)}
              </h1>
              <Badge {...statusBadgeProps(sync.status)}>{sync.status}</Badge>
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {sync.id}
            </p>
          </header>

          <Card className="mb-5">
            <CardContent>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-3">
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Started</dt>
                  <dd>{formatTimestamp(sync.startedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Completed
                  </dt>
                  <dd>{formatTimestamp(sync.completedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Duration
                  </dt>
                  <dd>{formatDuration(syncDurationMs(sync))}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {sync.errorMessage ? (
            <section className="mt-6" aria-label="Sync error">
              <Alert variant="destructive" className="mb-2">
                <AlertTitle>Sync error</AlertTitle>
                <AlertDescription>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-50 whitespace-pre-wrap break-words">
                    {sync.errorMessage}
                  </pre>
                </AlertDescription>
              </Alert>
            </section>
          ) : null}

          {sync.stages.map((stage) => (
            <section
              key={stage.stage}
              className="mt-6"
              aria-labelledby={`stage-${stage.stage}`}
            >
              <h2
                id={`stage-${stage.stage}`}
                className="mb-3 font-heading text-lg"
              >
                {STAGE_LABELS[stage.stage] ?? stage.stage}
              </h2>
              <div className="space-y-3">
                {stage.jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    className={`w-full rounded-xl bg-card p-4 text-left ring-1 transition-shadow ${
                      selectedJobId === job.id
                        ? 'ring-2 ring-foreground'
                        : 'ring-foreground/10 hover:ring-foreground/30'
                    }`}
                    onClick={() => void selectJob(job)}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {JOB_LABELS[job.job] ?? job.job}
                      </span>
                      <Badge {...statusBadgeProps(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Seen</dt>
                        <dd>{formatNumber(job.recordsSeen)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Inserted
                        </dt>
                        <dd>{formatNumber(job.recordsInserted)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Updated
                        </dt>
                        <dd>{formatNumber(job.recordsUpdated)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Failed</dt>
                        <dd
                          className={
                            job.recordsFailed > 0
                              ? 'font-semibold text-destructive'
                              : undefined
                          }
                        >
                          {formatNumber(job.recordsFailed)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Duration
                        </dt>
                        <dd>{formatDuration(job.durationMs)}</dd>
                      </div>
                    </dl>
                    {job.sourceUrl ? (
                      <p className="mt-2 truncate text-xs text-muted-foreground">
                        {job.sourceUrl}
                      </p>
                    ) : null}
                    {job.errorMessage ? (
                      <p className="mt-2 text-sm text-destructive">
                        {job.errorMessage}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}

          {selectedJob?.job === 'identifiers' && reconciliation ? (
            <section className="mt-6" aria-labelledby="reconciliation-heading">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 id="reconciliation-heading" className="font-heading text-lg">
                  Reconciliation
                </h2>
                {reconciliation.demoMismatches ? (
                  <Badge variant="secondary">demo</Badge>
                ) : null}
                {reconciliation.dryRun ? (
                  <Badge variant="outline">dry-run</Badge>
                ) : null}
              </div>
              <Card className="mb-5">
                <CardContent>
                  <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-3">
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">
                        Matched
                      </dt>
                      <dd>{formatNumber(reconciliation.matched)}</dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">
                        Unmatched
                      </dt>
                      <dd
                        className={
                          reconciliation.unmatched > 0
                            ? 'font-semibold text-destructive'
                            : undefined
                        }
                      >
                        {formatNumber(reconciliation.unmatched)}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">
                        Ambiguous
                      </dt>
                      <dd
                        className={
                          reconciliation.ambiguous > 0
                            ? 'font-semibold text-destructive'
                            : undefined
                        }
                      >
                        {formatNumber(reconciliation.ambiguous)}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-xs text-muted-foreground">
                        Identifiers added
                      </dt>
                      <dd>{formatNumber(reconciliation.identifiersAdded)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </section>
          ) : null}

          {selectedJob?.job === 'identifiers' && reconciliation ? (
            <section className="mt-6" aria-labelledby="unmatched-heading">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="unmatched-heading" className="font-heading text-lg">
                  Unmatched records
                </h2>
                <span className="text-muted-foreground">
                  {formatNumber(totalUnmatched)} total
                  {totalUnmatched > 0
                    ? ` · showing ${unmatchedOffset + 1}–${unmatchedOffset + unmatched.length}`
                    : null}
                </span>
              </div>

              {unmatchedLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : null}

              {!unmatchedLoading && unmatched.length === 0 ? (
                <p className="text-muted-foreground">
                  No unmatched records for this job.
                </p>
              ) : null}

              {!unmatchedLoading && unmatched.length > 0 ? (
                <>
                  <div className="rounded-xl bg-card ring-1 ring-foreground/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>External ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Set</TableHead>
                          <TableHead>#</TableHead>
                          <TableHead>Lang</TableHead>
                          <TableHead>Scryfall ID</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatched.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-sm">
                              {row.externalId}
                            </TableCell>
                            <TableCell className="max-w-xs whitespace-normal break-words">
                              {row.name ?? '—'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {row.setCode ?? '—'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {row.collectorNumber ?? '—'}
                            </TableCell>
                            <TableCell>{row.language ?? '—'}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {row.scryfallId ?? '—'}
                            </TableCell>
                            <TableCell className="max-w-sm whitespace-normal break-words">
                              {row.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Pagination className="mt-3 justify-start">
                    <PaginationContent className="mx-0">
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={unmatchedOffset === 0 || unmatchedLoading}
                          onClick={() =>
                            void loadUnmatchedPage(
                              Math.max(0, unmatchedOffset - PAGE_SIZE),
                            )
                          }
                        >
                          Previous
                        </Button>
                      </PaginationItem>
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            unmatchedOffset + PAGE_SIZE >= totalUnmatched ||
                            unmatchedLoading
                          }
                          onClick={() =>
                            void loadUnmatchedPage(unmatchedOffset + PAGE_SIZE)
                          }
                        >
                          Next
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </>
              ) : null}
            </section>
          ) : null}

          {selectedJob ? (
            <section className="mt-6" aria-labelledby="errors-heading">
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 id="errors-heading" className="font-heading text-lg">
                  Failed rows
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({JOB_LABELS[selectedJob.job] ?? selectedJob.job})
                  </span>
                </h2>
                <span className="text-muted-foreground">
                  {formatNumber(totalErrors)} total
                  {totalErrors > 0
                    ? ` · showing ${offset + 1}–${offset + errors.length}`
                    : null}
                </span>
              </div>

              {errorsLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : null}

              {!errorsLoading && errors.length === 0 ? (
                <p className="text-muted-foreground">
                  No failed rows for this job.
                </p>
              ) : null}

              {!errorsLoading && errors.length > 0 ? (
                <>
                  <Dialog
                    open={expandedPayload != null}
                    onOpenChange={(open) => {
                      if (!open) setExpandedPayload(null)
                    }}
                  >
                    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stage</TableHead>
                            <TableHead>External ID</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Payload</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errors.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.stage}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {row.externalId ?? '—'}
                              </TableCell>
                              <TableCell className="max-w-md whitespace-normal break-words">
                                {row.errorMessage}
                              </TableCell>
                              <TableCell>
                                {formatTimestamp(row.createdAt)}
                              </TableCell>
                              <TableCell>
                                {row.payload == null ? (
                                  '—'
                                ) : (
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={() => setExpandedPayload(row.id)}
                                  >
                                    Show
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <DialogContent className="sm:max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Error payload</DialogTitle>
                        <DialogDescription className="font-mono">
                          {payloadRow?.externalId ??
                            payloadRow?.stage ??
                            'Failed row'}
                        </DialogDescription>
                      </DialogHeader>
                      <pre className="max-h-[60vh] overflow-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-50 whitespace-pre-wrap break-words">
                        {JSON.stringify(payloadRow?.payload, null, 2)}
                      </pre>
                      <DialogFooter showCloseButton />
                    </DialogContent>
                  </Dialog>

                  <Pagination className="mt-3 justify-start">
                    <PaginationContent className="mx-0">
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={offset === 0 || errorsLoading}
                          onClick={() =>
                            void loadErrorPage(Math.max(0, offset - PAGE_SIZE))
                          }
                        >
                          Previous
                        </Button>
                      </PaginationItem>
                      <PaginationItem>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            offset + PAGE_SIZE >= totalErrors || errorsLoading
                          }
                          onClick={() => void loadErrorPage(offset + PAGE_SIZE)}
                        >
                          Next
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
