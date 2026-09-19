import { formatTimestamp } from '@/lib/format.ts';
import type { LiveLog } from '@/hooks/useSyncDetail.ts';

type LiveLogPanelProps = {
  logs: LiveLog[];
};

export const LiveLogPanel = ({ logs }: LiveLogPanelProps) => {
  if (logs.length === 0) {
    return (
      <section className="mt-6" aria-labelledby="live-log-heading">
        <h2 id="live-log-heading" className="mb-3 font-heading text-lg">
          Log
        </h2>
        <p className="text-sm text-muted-foreground">No log lines for this sync.</p>
      </section>
    );
  }

  return (
    <section className="mt-6" aria-labelledby="live-log-heading">
      <h2 id="live-log-heading" className="mb-3 font-heading text-lg">
        Log
      </h2>
      <div className="max-h-48 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs text-foreground ring-1 ring-foreground/10">
        {logs.map((line) => (
          <div key={line.id} className="whitespace-pre-wrap break-words">
            <span className="text-muted-foreground">[{formatTimestamp(line.at)}]</span>{' '}
            <span
              className={
                line.level === 'error'
                  ? 'text-red-400'
                  : line.level === 'warn'
                    ? 'text-amber-300'
                    : 'text-foreground/80'
              }
            >
              {line.level}
            </span>{' '}
            {line.message}
          </div>
        ))}
      </div>
    </section>
  );
};
