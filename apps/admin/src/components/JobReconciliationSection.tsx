import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/format.ts';
import type { IngestionReconciliation } from '@/lib/schemas/etl-sync.ts';

type JobReconciliationSectionProps = {
  reconciliation: IngestionReconciliation;
};

export const JobReconciliationSection = ({ reconciliation }: JobReconciliationSectionProps) => (
  <section className="mt-6" aria-labelledby="reconciliation-heading">
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 id="reconciliation-heading" className="font-heading text-lg">
        Reconciliation
      </h2>
      {reconciliation.demoMismatches ? <Badge variant="secondary">demo</Badge> : null}
      {reconciliation.dryRun ? <Badge variant="outline">dry-run</Badge> : null}
    </div>
    <Card className="mb-5">
      <CardContent>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-3">
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Matched</dt>
            <dd>{formatNumber(reconciliation.matched)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Unmatched</dt>
            <dd
              className={
                reconciliation.unmatched > 0 ? 'font-semibold text-destructive' : undefined
              }
            >
              {formatNumber(reconciliation.unmatched)}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Ambiguous</dt>
            <dd
              className={
                reconciliation.ambiguous > 0 ? 'font-semibold text-destructive' : undefined
              }
            >
              {formatNumber(reconciliation.ambiguous)}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Identifiers added</dt>
            <dd>{formatNumber(reconciliation.identifiersAdded)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </section>
);
