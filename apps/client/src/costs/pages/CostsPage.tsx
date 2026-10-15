import { cn } from 'cn';
import { useState } from 'react';

import {
  Alert,
  AlertDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@respark/ui/lib';

import { ApiError } from '@respark-client/core';

import { useCostSummary } from '../hooks/useCostSummary';
import { formatMoney, formatMonth } from '../lib/format';

export const CostsPage = () => {
  const { data: summary, isPending: loading, error: queryError } = useCostSummary();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError
        ? 'Could not load server costs'
        : null;

  const months = summary?.months ?? [];
  const currentMonth = months.at(-1);
  const selected = months.find((entry) => entry.month === selectedMonth) ?? currentMonth;
  const currency = summary?.currency ?? 'USD';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 text-left">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Server cost</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What Respark costs to run on AWS. Figures lag by about a day and exclude non-AWS services.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {currentMonth ? (
        <section aria-label="This month" className="rounded-lg border p-5">
          <p className="text-sm text-muted-foreground">{formatMonth(currentMonth.month)} so far</p>
          <p className="mt-1 font-heading text-4xl tracking-tight">
            {formatMoney(currentMonth.total, currency)}
          </p>
        </section>
      ) : null}

      {months.length ? (
        <section aria-label="By month" className="flex flex-col gap-2">
          <h2 className="font-heading text-lg tracking-tight">By month</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...months].reverse().map((entry) => (
                <TableRow
                  key={entry.month}
                  data-state={entry.month === selected?.month ? 'selected' : undefined}
                >
                  <TableCell>
                    <button
                      type="button"
                      className={cn(
                        'text-left hover:underline',
                        entry.month === selected?.month && 'font-medium',
                      )}
                      onClick={() => setSelectedMonth(entry.month)}
                    >
                      {formatMonth(entry.month)}
                      {entry === currentMonth ? ' (to date)' : ''}
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(entry.total, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {selected ? (
        <section aria-label="By service" className="flex flex-col gap-2">
          <h2 className="font-heading text-lg tracking-tight">
            {formatMonth(selected.month)} by service
          </h2>
          {selected.byService.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.byService.map((entry) => (
                  <TableRow key={entry.service}>
                    <TableCell>{entry.service}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(entry.amount, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No costs recorded for this month.</p>
          )}
        </section>
      ) : null}

      {summary ? (
        <p className="text-xs text-muted-foreground">
          Updated {new Date(summary.updatedAt).toLocaleString()}
        </p>
      ) : null}
    </main>
  );
};
