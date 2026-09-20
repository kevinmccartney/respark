import { OffsetPagination } from '@/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/ui/table';
import type { IngestionUnmatched } from 'schemas/etl-sync';
import { formatNumber } from '../lib/format.ts';
import { PAGE_SIZE } from '../lib/syncs.ts';

type JobUnmatchedSectionProps = {
  unmatched: IngestionUnmatched[];
  total: number;
  offset: number;
  loading: boolean;
  onPage: (offset: number) => void;
};

export const JobUnmatchedSection = ({
  unmatched,
  total,
  offset,
  loading,
  onPage,
}: JobUnmatchedSectionProps) => (
  <section className="mt-6" aria-labelledby="unmatched-heading">
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id="unmatched-heading" className="font-heading text-lg">
        Unmatched records
      </h2>
      <span className="text-muted-foreground">
        {formatNumber(total)} total
        {total > 0 ? ` · showing ${offset + 1}–${offset + unmatched.length}` : null}
      </span>
    </div>

    {loading ? <p className="text-muted-foreground">Loading…</p> : null}

    {!loading && unmatched.length === 0 ? (
      <p className="text-muted-foreground">No unmatched records for this job.</p>
    ) : null}

    {!loading && unmatched.length > 0 ? (
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
                  <TableCell className="font-mono text-sm">{row.externalId}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal break-words">
                    {row.name ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.setCode ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{row.collectorNumber ?? '—'}</TableCell>
                  <TableCell>{row.language ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{row.scryfallId ?? '—'}</TableCell>
                  <TableCell className="max-w-sm whitespace-normal break-words">
                    {row.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
