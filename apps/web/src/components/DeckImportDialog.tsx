import { useAuth } from '@clerk/react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiError } from '../lib/api.ts';
import { importDeckList, type DeckDetail, type DeckImportUnmatched } from '../lib/decks.ts';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
  onImported: (detail: DeckDetail) => void;
};

export const DeckImportDialog = ({ open, onOpenChange, deckId, onImported }: Props) => {
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<DeckImportUnmatched[] | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const resetState = () => {
    setText('');
    setError(null);
    setUnmatched(null);
    setImportedCount(null);
    setImporting(false);
  };

  const handleImport = async () => {
    if (!text.trim() || importing) return;
    setImporting(true);
    setError(null);
    setUnmatched(null);
    setImportedCount(null);
    try {
      const result = await importDeckList(getToken, deckId, text);
      setImportedCount(result.imported);
      setUnmatched(result.unmatched);
      onImported(result.detail);
      if (result.unmatched.length === 0) {
        onOpenChange(false);
        resetState();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not import deck list');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetState();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-[min(calc(100%-2rem),40rem)]">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle>Import list</DialogTitle>
              <DialogDescription>
                Paste a Moxfield export (
                <span className="font-mono text-xs">1 Card Name (SET) 123 *F*</span>
                ). Use a <span className="font-mono text-xs">SIDEBOARD:</span> section (or{' '}
                <span className="font-mono text-xs">SB:</span> lines) for sideboard cards;{' '}
                <span className="font-mono text-xs">*F*</span> marks foil.
              </DialogDescription>
            </div>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Close
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="deck-import-text">Deck list</Label>
              <textarea
                id="deck-import-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={12}
                placeholder={`1 Sol Ring (LCC) 313\n1 Arcane Signet (LCC) 299`}
                disabled={importing}
                className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {importedCount !== null ? (
              <p className="text-sm text-muted-foreground">
                Imported {importedCount} unique printing
                {importedCount === 1 ? '' : 's'}.
              </p>
            ) : null}

            {unmatched && unmatched.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {unmatched.length} line{unmatched.length === 1 ? '' : 's'} not imported
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                  {unmatched.map((row) => (
                    <li key={`${row.line}-${row.reason}`} className="break-all">
                      <span className="font-mono">{row.line}</span>
                      <span className="text-muted-foreground"> — {row.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <DialogClose render={<Button type="button" variant="outline" disabled={importing} />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              disabled={!text.trim() || importing}
              onClick={() => void handleImport()}
            >
              {importing ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
};
