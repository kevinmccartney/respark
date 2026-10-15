import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { CardPrintingSummary } from '@respark/schemas/cards';
import { BackButton } from '@respark/ui/back-button';
import { Alert, AlertDescription } from '@respark/ui/lib';

import { ApiError, isNotFound, NotFoundPage } from '@respark-client/core';

import { CardDetailView } from '../components/CardDetailView';
import { useCard } from '../hooks/cards';

export const CardDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const printingParam = searchParams.get('printing');

  const { data: card, isPending: loading, error: queryError } = useCard(id);
  const notFound = Boolean(queryError && isNotFound(queryError));
  const error =
    queryError && !isNotFound(queryError)
      ? queryError instanceof ApiError
        ? queryError.message
        : 'Could not load card'
      : null;

  const selectedPrinting = useMemo(() => {
    if (!card || card.printings.length === 0) return null;
    return card.printings.find((p) => p.id === printingParam) ?? card.printings[0];
  }, [card, printingParam]);

  const selectPrinting = (printing: CardPrintingSummary) => {
    const next = new URLSearchParams(searchParams);
    // Default printing is the first (newest); omit param when selected.
    if (card && printing.id === card.printings[0]?.id) next.delete('printing');
    else next.set('printing', printing.id);
    setSearchParams(next, { replace: true });
  };

  if (notFound) {
    return (
      <NotFoundPage
        title="Card not found"
        description="That card isn not in the catalog — it may have been skipped on import."
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8 text-left">
      <div>
        <BackButton fallbackTo="/search" />
      </div>

      {loading ? (
        <p className="text-muted-foreground" aria-live="polite">
          Loading card…
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && card ? (
        <CardDetailView
          card={card}
          selectedPrinting={selectedPrinting}
          onSelectPrinting={selectPrinting}
        />
      ) : null}
    </main>
  );
};
