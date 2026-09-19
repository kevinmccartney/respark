import { useAuth } from '@clerk/react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { ApiError } from '../lib/api.ts';
import { createDeck, DECK_FORMAT_LABELS, DECK_FORMATS, type DeckFormat } from '../lib/decks.ts';

export const NewDeckPage = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<DeckFormat>('standard');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedName || saving) return;

    setSaving(true);
    setError(null);
    try {
      const deck = await createDeck(getToken, {
        name: trimmedName,
        description: description.trim() || undefined,
        format,
      });
      navigate(`/decks/${deck.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create deck');
      setSaving(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center gap-8 px-6 py-12 text-center">
        <header className="max-w-lg">
          <h1 className="font-heading text-3xl tracking-tight">New deck</h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Name it, pick a format, then search and add cards.
          </p>
        </header>

        <Card className="w-full max-w-md text-left" aria-labelledby="new-deck-heading">
          <CardHeader>
            <CardTitle id="new-deck-heading">Deck details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="deck-name">Deck name</Label>
                <Input
                  id="deck-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Mono-Red Burn"
                  maxLength={120}
                  autoFocus
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deck-format">Format</Label>
                <select
                  id="deck-format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as DeckFormat)}
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

              <div className="space-y-1.5">
                <Label htmlFor="deck-description">Description</Label>
                <textarea
                  id="deck-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional notes about the deck…"
                  maxLength={2000}
                  rows={3}
                  disabled={saving}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mt-2 flex justify-end gap-2">
                <Button variant="outline" render={<Link to="/home" />}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!trimmedName || saving}>
                  {saving ? 'Creating…' : 'Create deck'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
};
