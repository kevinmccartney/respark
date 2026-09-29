import { useUser } from '@clerk/react';
import { cn } from 'cn';
import { Heart, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, Button } from '@respark/ui/lib';

import { ColorIdentity } from '@respark-client/cards';
import { ApiError } from '@respark-client/core';
import { DECK_FORMAT_LABELS, formatRelativeTime, useDecks } from '@respark-client/decks';
import { COLOR_STYLES, isGameInProgress, loadGame } from '@respark-client/life';

const RECENT_DECK_COUNT = 4;

const QuickActions = () => (
  <div className="flex flex-wrap gap-2">
    <Button nativeButton={false} render={<Link to="/decks/new" />}>
      <Plus data-icon="inline-start" />
      New deck
    </Button>
    <Button variant="outline" nativeButton={false} render={<Link to="/search" />}>
      <Search data-icon="inline-start" />
      Search cards
    </Button>
    <Button variant="outline" nativeButton={false} render={<Link to="/life" />}>
      <Heart data-icon="inline-start" />
      Start a game
    </Button>
  </div>
);

const ResumeGame = () => {
  const [game] = useState(loadGame);
  if (!isGameInProgress(game)) return null;

  return (
    <section
      aria-labelledby="resume-game-heading"
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-col gap-2">
        <h2 id="resume-game-heading" className="text-sm font-medium text-muted-foreground">
          Game in progress
        </h2>
        <div className="flex flex-wrap gap-2">
          {game.players.map((player, index) => (
            <span
              key={index}
              className={cn(
                'flex items-baseline gap-2 rounded-md border px-3 py-1.5',
                COLOR_STYLES[player.color].panel,
              )}
            >
              <span className="text-sm">{player.name}</span>
              <span className="font-heading text-xl tabular-nums">{player.life}</span>
            </span>
          ))}
        </div>
      </div>
      <Button nativeButton={false} render={<Link to="/life" />}>
        Resume
      </Button>
    </section>
  );
};

const RecentDecks = () => {
  const { data: decks = [], isPending: loading, error: queryError } = useDecks();
  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError
        ? 'Could not load decks'
        : null;

  const recent = useMemo(
    () =>
      [...decks]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, RECENT_DECK_COUNT),
    [decks],
  );

  return (
    <section aria-labelledby="recent-decks-heading" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4">
        <h2 id="recent-decks-heading" className="font-heading text-xl tracking-tight">
          Recent decks
        </h2>
        {decks.length > 0 ? (
          <Link to="/decks" className="text-sm text-muted-foreground hover:text-foreground">
            All decks
          </Link>
        ) : null}
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">No decks yet.</p>
          <Button size="sm" nativeButton={false} render={<Link to="/decks/new" />}>
            New deck
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {recent.map((deck) => (
            <li key={deck.id}>
              <Link
                to={`/decks/${deck.id}`}
                className="flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{deck.name}</span>
                  <ColorIdentity colors={deck.colorIdentity} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {DECK_FORMAT_LABELS[deck.format]} · edited {formatRelativeTime(deck.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const HomePage = () => {
  const { user } = useUser();
  const firstName = user?.firstName?.trim();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 overflow-y-auto px-6 py-8 text-left">
      <header className="flex flex-col gap-4">
        <h1 className="font-heading text-3xl tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
        <QuickActions />
      </header>
      <ResumeGame />
      <RecentDecks />
    </main>
  );
};
