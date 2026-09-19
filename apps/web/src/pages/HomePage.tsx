import { useAuth, useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from '../components/SiteHeader.tsx';
import { ApiError } from '../lib/api.ts';
import { DECK_FORMAT_LABELS, fetchDecks, type Deck } from '../lib/decks.ts';

export function HomePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const firstName = user?.firstName?.trim();
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back';

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDecks() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchDecks(getToken);
        if (!controller.signal.aborted) {
          setDecks(list);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Could not load decks');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDecks();

    return () => controller.abort();
  }, [getToken]);

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center gap-8 px-6 py-12 text-center">
        <header className="max-w-lg">
          <h1 className="font-heading text-3xl tracking-tight">{greeting}</h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Your decks sync from the API when you&apos;re signed in.
          </p>
        </header>

        <Card className="w-full max-w-md text-left" aria-labelledby="decks-heading">
          <CardHeader>
            <CardTitle id="decks-heading">Your decks</CardTitle>
            <CardAction>
              <Button render={<Link to="/decks/new" />}>New deck</Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-muted-foreground">Loading decks…</p> : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {!loading && !error && decks.length === 0 ? (
              <p className="text-muted-foreground">No decks yet — create your first one.</p>
            ) : null}
            {!loading && !error && decks.length > 0 ? (
              <ul className="divide-y">
                {decks.map((deck) => (
                  <li key={deck.id} className="flex justify-between gap-4 py-2">
                    <div className="min-w-0">
                      <Link to={`/decks/${deck.id}`} className="font-medium hover:underline">
                        {deck.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {DECK_FORMAT_LABELS[deck.format]}
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-sm text-muted-foreground"
                      dateTime={deck.updatedAt}
                    >
                      {new Date(deck.updatedAt).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
