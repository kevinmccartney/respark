import { useAuth } from "@clerk/react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader.tsx";
import { ApiError } from "../lib/api.ts";
import { createDeck } from "../lib/decks.ts";

export function NewDeckPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedName || saving) return;

    setSaving(true);
    setError(null);
    try {
      await createDeck(getToken, trimmedName);
      navigate("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create deck");
      setSaving(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="home-main">
        <header className="home-intro">
          <h1>New deck</h1>
          <p className="home-subtitle">
            Name it now — you can add cards once the catalog lands.
          </p>
        </header>

        <section className="decks-panel" aria-labelledby="new-deck-heading">
          <h2 id="new-deck-heading">Deck details</h2>
          <form className="deck-form" onSubmit={handleSubmit}>
            <label className="deck-form-label" htmlFor="deck-name">
              Deck name
            </label>
            <input
              id="deck-name"
              className="deck-form-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mono-Red Burn"
              maxLength={120}
              autoFocus
              required
              disabled={saving}
            />

            {error ? (
              <p className="decks-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="deck-form-actions">
              <Link to="/home" className="auth-button">
                Cancel
              </Link>
              <button
                type="submit"
                className="auth-button auth-button-primary"
                disabled={!trimmedName || saving}
              >
                {saving ? "Creating…" : "Create deck"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
