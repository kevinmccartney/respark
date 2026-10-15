import { useState } from 'react';

import { DECK_SAVE_NOTE_MAX_LENGTH, type DeckChanges } from '@respark/schemas/deck-revisions';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Label,
} from '@respark/ui/lib';

import { formatRelativeTime } from '../lib/format';

import { DeckChangesList } from './DeckChangesList';

type Props = {
  pendingChanges: DeckChanges | null;
  pendingCount: number;
  savedAt: string | null;
  onSave: (note: string) => Promise<boolean>;
  onDiscard: () => Promise<boolean>;
};

export const DeckSaveBar = ({
  pendingChanges,
  pendingCount,
  savedAt,
  onSave,
  onDiscard,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!pendingChanges || pendingCount === 0) return null;

  const save = async () => {
    setBusy(true);
    const ok = await onSave(note);
    setBusy(false);
    if (ok) {
      setOpen(false);
      setNote('');
    }
  };

  const discard = async () => {
    const confirmed = window.confirm(
      `Discard ${pendingCount} unsaved change${pendingCount === 1 ? '' : 's'}? The deck goes back to its last save.`,
    );
    if (!confirmed) return;
    setBusy(true);
    await onDiscard();
    setBusy(false);
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-chart-1/40 bg-chart-1/5 px-4 py-3"
    >
      <p className="text-sm">
        <span className="font-medium">
          {pendingCount} unsaved change{pendingCount === 1 ? '' : 's'}
        </span>
        {savedAt ? (
          <span className="text-muted-foreground"> since {formatRelativeTime(savedAt)}</span>
        ) : null}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void discard()}
        >
          Discard
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => setOpen(true)}>
          Save
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(90vh,40rem)] w-[min(calc(100%-2rem),32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[32rem]"
        >
          <div className="space-y-1 border-b px-4 py-3">
            <DialogTitle>Save changes</DialogTitle>
            <DialogDescription>
              Adds an entry to this deck&apos;s history with the changes below.
            </DialogDescription>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <DeckChangesList changes={pendingChanges} />
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="deck-save-note">Note (optional)</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {note.length}/{DECK_SAVE_NOTE_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="deck-save-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={DECK_SAVE_NOTE_MAX_LENGTH}
                rows={3}
                placeholder="e.g. Cut the ramp package"
                disabled={busy}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <DialogClose render={<Button type="button" variant="outline" disabled={busy} />}>
              Cancel
            </DialogClose>
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
