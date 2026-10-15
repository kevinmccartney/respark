import { countDeckChanges } from '@respark/schemas/deck-revisions';

import { useDeckRevisions } from '../hooks/useDeckDetail';
import { formatRelativeTime } from '../lib/format';

import { DeckChangesList } from './DeckChangesList';

export const DeckChangelog = ({ deckId }: { deckId: string }) => {
  const { data, isPending, error } = useDeckRevisions(deckId);

  return (
    <section className="space-y-4" aria-label="Changelog">
      {isPending ? <p className="text-sm text-muted-foreground">Loading history…</p> : null}
      {error ? <p className="text-sm text-destructive">Could not load history.</p> : null}
      {data && data.revisions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saves yet.</p>
      ) : null}
      {data && data.revisions.length > 0 ? (
        <ol className="space-y-4">
          {data.revisions.map((revision) => (
            <li key={revision.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium break-words">{revision.note ?? 'Saved'}</p>
                <time
                  dateTime={revision.createdAt}
                  title={new Date(revision.createdAt).toLocaleString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatRelativeTime(revision.createdAt)}
                </time>
              </div>
              {countDeckChanges(revision.changes) > 0 ? (
                <DeckChangesList changes={revision.changes} />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {data && data.total > data.revisions.length ? (
        <p className="text-xs text-muted-foreground">
          Showing the latest {data.revisions.length} of {data.total} saves.
        </p>
      ) : null}
    </section>
  );
};
