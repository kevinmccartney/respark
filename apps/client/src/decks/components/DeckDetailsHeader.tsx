import { LucideX } from 'lucide-react';
import { useState } from 'react';

import { DECK_FORMATS } from '@respark/schemas/decks';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
} from '@respark/ui/lib';

import { ColorIdentity } from '@respark-client/cards';

import { DECK_FORMAT_LABELS } from '../constants';
import type { Deck, DeckFormat } from '../types';

import { CommanderPicker } from './CommanderPicker';

type Props = {
  deck: Deck;
  commanderName: string | null;
  mainTotal: number;
  sideTotal: number;
  uniqueCount: number;
  onImport: () => void;
  onSave: (input: {
    name: string;
    format: DeckFormat;
    description: string | null;
    commanderPrintingId: string | null;
  }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onBeginEdit?: () => void;
};

type CommanderDraft = { printingId: string; name: string } | null;

const commanderFromProps = (
  commanderPrintingId: string | null,
  commanderName: string | null,
): CommanderDraft =>
  commanderPrintingId && commanderName
    ? { printingId: commanderPrintingId, name: commanderName }
    : null;

export const DeckDetailsHeader = ({
  deck,
  commanderName,
  mainTotal,
  sideTotal,
  uniqueCount,
  onImport,
  onSave,
  onDelete,
  onBeginEdit,
}: Props) => {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(deck.name);
  const [formatDraft, setFormatDraft] = useState<DeckFormat>(deck.format);
  const [descriptionDraft, setDescriptionDraft] = useState(deck.description ?? '');
  const [commanderDraft, setCommanderDraft] = useState<CommanderDraft>(
    commanderFromProps(deck.commanderPrintingId, commanderName),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resetDrafts = () => {
    setNameDraft(deck.name);
    setFormatDraft(deck.format);
    setDescriptionDraft(deck.description ?? '');
    setCommanderDraft(commanderFromProps(deck.commanderPrintingId, commanderName));
  };

  const openEdit = (open: boolean) => {
    if (open) {
      onBeginEdit?.();
      resetDrafts();
      setEditing(true);
      return;
    }
    if (saving) return;
    setEditing(false);
  };

  const save = async () => {
    const trimmedName = nameDraft.trim();
    if (!trimmedName || saving) return;
    if (formatDraft === 'commander' && !commanderDraft) return;
    setSaving(true);
    try {
      const ok = await onSave({
        name: trimmedName,
        format: formatDraft,
        description: descriptionDraft.trim() || null,
        commanderPrintingId:
          formatDraft === 'commander' ? (commanderDraft?.printingId ?? null) : null,
      });
      if (ok) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    const confirmed = window.confirm(`Delete "${deck.name}"? This cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      const ok = await onDelete();
      if (!ok) setDeleting(false);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h1 className="font-heading text-3xl tracking-tight">{deck.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <ColorIdentity colors={deck.colorIdentity} />
              <span>
                {DECK_FORMAT_LABELS[deck.format]}
                {commanderName ? ` · ${commanderName}` : ''} · {mainTotal} card
                {mainTotal === 1 ? '' : 's'}
                {sideTotal > 0 ? ` · ${sideTotal} sideboard` : ''} · {uniqueCount} unique
              </span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="chart" size="sm" onClick={onImport}>
              Import
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(true)}>
              Edit details
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void remove()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
        {deck.description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {deck.description}
          </p>
        ) : null}
      </header>

      <Dialog open={editing} onOpenChange={openEdit}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(90vh,40rem)] w-[min(calc(100%-2rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
            <div className="min-w-0 space-y-1">
              <DialogTitle>Edit deck details</DialogTitle>
              <DialogDescription>Update name, format, commander, and notes.</DialogDescription>
            </div>
            <DialogClose
              render={<Button type="button" variant="ghost" size="sm" disabled={saving} />}
            >
              <LucideX />
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deck-name">Name</Label>
                <Input
                  id="deck-name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={120}
                  required
                  disabled={saving}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deck-format">Format</Label>
                <select
                  id="deck-format"
                  value={formatDraft}
                  onChange={(event) => {
                    const next = event.target.value as DeckFormat;
                    setFormatDraft(next);
                    if (next !== 'commander') setCommanderDraft(null);
                  }}
                  disabled={saving}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {DECK_FORMATS.map((value) => (
                    <option key={value} value={value}>
                      {DECK_FORMAT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {formatDraft === 'commander' ? (
              <div className="space-y-1.5">
                <Label>Commander</Label>
                <CommanderPicker
                  printingId={commanderDraft?.printingId ?? null}
                  name={commanderDraft?.name ?? null}
                  disabled={saving}
                  onChange={setCommanderDraft}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="deck-description">Description</Label>
              <textarea
                id="deck-description"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                placeholder="Optional notes about the deck…"
                maxLength={2000}
                rows={3}
                disabled={saving}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              disabled={
                saving || !nameDraft.trim() || (formatDraft === 'commander' && !commanderDraft)
              }
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
