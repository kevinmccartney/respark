import { useAuth, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.tsx";
import { ApiError } from "../lib/api.ts";
import { fetchDecks, type Deck } from "../lib/decks.ts";

export function HomePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const firstName = user?.firstName?.trim();
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

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
          setError("Could not load decks");
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
      <main className="home-main">
        <header className="home-intro">
          <h1>{greeting}</h1>
          <p className="home-subtitle">
            Your decks sync from the API when you&apos;re signed in.
          </p>
        </header>

        <section className="decks-panel" aria-labelledby="decks-heading">
          <div className="decks-panel-header">
            <h2 id="decks-heading">Your decks</h2>
            <Link to="/decks/new" className="auth-button">
              New deck
            </Link>
          </div>
          {loading ? <p className="decks-muted">Loading decks…</p> : null}
          {error ? <p className="decks-error">{error}</p> : null}
          {!loading && !error && decks.length === 0 ? (
            <p className="decks-muted">
              No decks yet — create your first one.
            </p>
          ) : null}
          {!loading && !error && decks.length > 0 ? (
            <ul className="deck-list">
              {decks.map((deck) => (
                <li key={deck.id}>
                  <span className="deck-name">{deck.name}</span>
                  <time className="deck-updated" dateTime={deck.updatedAt}>
                    {new Date(deck.updatedAt).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </>
  );
}
