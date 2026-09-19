import { Badge } from '@/components/ui/badge';
import { formatDuration, formatNumber, statusBadgeProps } from '@/lib/format.ts';
import type { EtlJobRun, EtlSync } from 'schemas/etl-sync';
import { JOB_LABELS, STAGE_LABELS } from '@/lib/syncs.ts';

type SyncJobListProps = {
  sync: EtlSync;
  selectedJobId: string | null;
  onSelect: (job: EtlJobRun) => void;
};

export const SyncJobList = ({ sync, selectedJobId, onSelect }: SyncJobListProps) => (
  <>
    {sync.stages.map((stage) => (
      <section key={stage.stage} className="mt-6" aria-labelledby={`stage-${stage.stage}`}>
        <h2 id={`stage-${stage.stage}`} className="mb-3 font-heading text-lg">
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
              onClick={() => onSelect(job)}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-medium">{JOB_LABELS[job.job] ?? job.job}</span>
                <Badge {...statusBadgeProps(job.status)}>{job.status}</Badge>
              </div>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Seen</dt>
                  <dd>{formatNumber(job.recordsSeen)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Inserted</dt>
                  <dd>{formatNumber(job.recordsInserted)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Updated</dt>
                  <dd>{formatNumber(job.recordsUpdated)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Failed</dt>
                  <dd
                    className={job.recordsFailed > 0 ? 'font-semibold text-destructive' : undefined}
                  >
                    {formatNumber(job.recordsFailed)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Duration</dt>
                  <dd>{formatDuration(job.durationMs)}</dd>
                </div>
              </dl>
              {job.sourceUrl ? (
                <p className="mt-2 truncate text-xs text-muted-foreground">{job.sourceUrl}</p>
              ) : null}
              {job.errorMessage ? (
                <p className="mt-2 text-sm text-destructive">{job.errorMessage}</p>
              ) : null}
            </button>
          ))}
        </div>
      </section>
    ))}
  </>
);
