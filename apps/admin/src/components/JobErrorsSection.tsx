import { OffsetPagination } from '@/components/OffsetPagination.tsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber, formatTimestamp } from '@/lib/format.ts';
import { JOB_LABELS, PAGE_SIZE } from '@/lib/syncs.ts';
import type { EtlJobRun, IngestionError } from '@/lib/schemas/etl-sync.ts';

type JobErrorsSectionProps = {
  job: EtlJobRun;
  errors: IngestionError[];
  total: number;
  offset: number;
  loading: boolean;
  expandedPayload: number | null;
  payloadRow: IngestionError | null;
  onExpand: (id: number | null) => void;
  onPage: (offset: number) => void;
};

export const JobErrorsSection = ({
  job,
  errors,
  total,
  offset,
  loading,
  expandedPayload,
  payloadRow,
  onExpand,
  onPage,
}: JobErrorsSectionProps) => (
  <section className="mt-6" aria-labelledby="errors-heading">
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id="errors-heading" className="font-heading text-lg">
        Failed rows
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({JOB_LABELS[job.job] ?? job.job})
        </span>
      </h2>
      <span className="text-muted-foreground">
        {formatNumber(total)} total
        {total > 0 ? ` · showing ${offset + 1}-${offset + errors.length}` : null}
      </span>
    </div>

    {loading ? <p className="text-muted-foreground">Loading…</p> : null}

    {!loading && errors.length === 0 ? (
      <p className="text-muted-foreground">No failed rows for this job.</p>
    ) : null}

    {!loading && errors.length > 0 ? (
      <>
        <Dialog
          open={expandedPayload != null}
          onOpenChange={(open) => {
            if (!open) onExpand(null);
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
                    <TableCell className="font-mono text-sm">{row.externalId ?? '—'}</TableCell>
                    <TableCell className="max-w-md whitespace-normal break-words">
                      {row.errorMessage}
                    </TableCell>
                    <TableCell>{formatTimestamp(row.createdAt)}</TableCell>
                    <TableCell>
                      {row.payload == null ? (
                        '—'
                      ) : (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => onExpand(row.id)}
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
                {payloadRow?.externalId ?? payloadRow?.stage ?? 'Failed row'}
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs text-foreground whitespace-pre-wrap break-words">
              {JSON.stringify(payloadRow?.payload, null, 2)}
            </pre>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>

        <OffsetPagination
          offset={offset}
          total={total}
          pageSize={PAGE_SIZE}
          loading={loading}
          onPrev={() => onPage(Math.max(0, offset - PAGE_SIZE))}
          onNext={() => onPage(offset + PAGE_SIZE)}
        />
      </>
    ) : null}
  </section>
);
