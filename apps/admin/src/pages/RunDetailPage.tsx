import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "../lib/api.ts";
import {
  formatDuration,
  formatNumber,
  formatTimestamp,
  statusBadgeProps,
} from "../lib/format.ts";
import {
  fetchIngestionErrors,
  fetchIngestionRun,
  isForbidden,
  type IngestionError,
  type IngestionRun,
} from "../lib/runs.ts";

const PAGE_SIZE = 50;

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [run, setRun] = useState<IngestionRun | null>(null);
  const [errors, setErrors] = useState<IngestionError[]>([]);
  const [totalErrors, setTotalErrors] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [expandedPayload, setExpandedPayload] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setForbidden(false);
      setOffset(0);
      try {
        const [runRow, errorPage] = await Promise.all([
          fetchIngestionRun(getToken, id!),
          fetchIngestionErrors(getToken, id!, { limit: PAGE_SIZE, offset: 0 }),
        ]);
        if (controller.signal.aborted) return;
        setRun(runRow);
        setErrors(errorPage.errors);
        setTotalErrors(errorPage.total);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (isForbidden(err)) {
          setForbidden(true);
          setError(
            'Your account is not an admin. Set publicMetadata.role to "admin" in Clerk.',
          );
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Could not load run");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [getToken, id]);

  async function loadErrorPage(nextOffset: number) {
    if (!id) return;
    setErrorsLoading(true);
    try {
      const errorPage = await fetchIngestionErrors(getToken, id, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setErrors(errorPage.errors);
      setTotalErrors(errorPage.total);
      setOffset(nextOffset);
      setExpandedPayload(null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Could not load failed rows");
    } finally {
      setErrorsLoading(false);
    }
  }

  const payloadRow =
    expandedPayload == null
      ? null
      : (errors.find((e) => e.id === expandedPayload) ?? null);

  return (
    <main className="mx-auto max-w-6xl px-5 py-5">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>Runs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Run detail</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {loading ? <p className="text-muted-foreground">Loading…</p> : null}
      {error ? (
        <Alert variant={forbidden ? "destructive" : "default"} className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {run ? (
        <>
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl tracking-tight">
                {run.source}
              </h1>
              <Badge {...statusBadgeProps(run.status)}>{run.status}</Badge>
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {run.id}
            </p>
          </header>

          <Card className="mb-5">
            <CardContent>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-3">
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Started
                  </dt>
                  <dd>{formatTimestamp(run.startedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Completed
                  </dt>
                  <dd>{formatTimestamp(run.completedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Duration
                  </dt>
                  <dd>{formatDuration(run.durationMs)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Source version
                  </dt>
                  <dd>{run.sourceVersion ?? "—"}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Seen</dt>
                  <dd>{formatNumber(run.recordsSeen)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Inserted
                  </dt>
                  <dd>{formatNumber(run.recordsInserted)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Updated
                  </dt>
                  <dd>{formatNumber(run.recordsUpdated)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Unchanged
                  </dt>
                  <dd>{formatNumber(run.recordsUnchanged)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">Failed</dt>
                  <dd
                    className={
                      run.recordsFailed > 0
                        ? "font-semibold text-destructive"
                        : undefined
                    }
                  >
                    {formatNumber(run.recordsFailed)}
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Download
                  </dt>
                  <dd>
                    {run.downloadBytes != null
                      ? `${formatNumber(run.downloadBytes)} bytes`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {run.sourceUrl ? (
            <p className="mb-5 text-muted-foreground">
              Source URL:{" "}
              <a
                href={run.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                {run.sourceUrl}
              </a>
            </p>
          ) : null}

          {run.errorMessage ? (
            <section className="mt-6" aria-label="Run error">
              <Alert variant="destructive" className="mb-2">
                <AlertTitle>Run error</AlertTitle>
                <AlertDescription>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-50 whitespace-pre-wrap break-words">
                    {run.errorMessage}
                  </pre>
                </AlertDescription>
              </Alert>
            </section>
          ) : null}

          <section className="mt-6" aria-labelledby="errors-heading">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="errors-heading" className="font-heading text-lg">
                Failed rows
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
                No failed rows for this run.
              </p>
            ) : null}

            {!errorsLoading && errors.length > 0 ? (
              <>
                <Dialog
                  open={expandedPayload != null}
                  onOpenChange={(open) => {
                    if (!open) setExpandedPayload(null);
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
                              {row.externalId ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-md whitespace-normal break-words">
                              {row.errorMessage}
                            </TableCell>
                            <TableCell>
                              {formatTimestamp(row.createdAt)}
                            </TableCell>
                            <TableCell>
                              {row.payload == null ? (
                                "—"
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
                          "Failed row"}
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
        </>
      ) : null}
    </main>
  );
}
