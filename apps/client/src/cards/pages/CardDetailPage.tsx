import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  isLeadershipCommander,
  printingHasFoilTreatment,
  type CardPrintingSummary,
} from '@respark/schemas/cards';
import { DECK_FORMATS, type DeckFormat } from '@respark/schemas/decks';
import { Alert, AlertDescription, Badge, Button } from '@respark/ui/lib';
import { ManaCost, ManaText } from '@respark/ui/mana';

import { ApiError, goBackOrHome, isNotFound, NotFoundPage } from '@respark-client/core';

import { ColorIdentity } from '../components/ColorIdentity';
import { FlippableCardImage } from '../components/FlippableCardImage';
import { PrintingFinishes } from '../components/FoilMark';
import { useCard } from '../hooks/cards';
import { resolveCardFace } from '../lib/card-faces';

const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
};

export const CardDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [faceIndex, setFaceIndex] = useState(0);

  const selectedPrinting = useMemo(() => {
    if (!card || card.printings.length === 0) return null;
    return card.printings.find((p) => p.id === printingParam) ?? card.printings[0];
  }, [card, printingParam]);

  useEffect(() => {
    setFaceIndex(0);
  }, [selectedPrinting?.id]);

  const selectPrinting = (printing: CardPrintingSummary) => {
    const next = new URLSearchParams(searchParams);
    // Default printing is the first (newest); omit param when selected.
    if (card && printing.id === card.printings[0]?.id) next.delete('printing');
    else next.set('printing', printing.id);
    setSearchParams(next, { replace: true });
  };

  const faceView = resolveCardFace({
    faces: selectedPrinting?.faces ?? [],
    faceIndex,
    name: card?.name ?? '',
    manaCost: card?.manaCost ?? null,
    typeLine: card?.typeLine ?? null,
    oracleText: card?.oracleText ?? null,
    imageNormal: selectedPrinting?.imageNormal ?? null,
    imageLarge: selectedPrinting?.imageLarge ?? null,
    preferLarge: true,
  });
  const displayed = faceView.displayed;

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
        <Button type="button" variant="default" size="sm" onClick={() => goBackOrHome(navigate)}>
          Back
        </Button>
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
        <>
          <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
            <FlippableCardImage
              src={displayed.imageSrc}
              alt={displayed.name}
              foil={selectedPrinting ? printingHasFoilTreatment(selectedPrinting.finishes) : false}
              canFlip={faceView.canFlip}
              nextFaceName={faceView.nextFaceName}
              onFlip={() => {
                const faceCount = selectedPrinting?.faces.length ?? 0;
                if (faceCount < 2) return;
                setFaceIndex((current) => (current + 1) % faceCount);
              }}
            />

            <div className="space-y-4">
              <header className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="font-heading text-3xl tracking-tight">{displayed.name}</h1>
                  {displayed.manaCost ? <ManaCost cost={displayed.manaCost} size={18} /> : null}
                </div>
                {displayed.typeLine ? (
                  <p className="text-muted-foreground">{displayed.typeLine}</p>
                ) : null}
              </header>

              {displayed.oracleText ? (
                <ManaText
                  text={displayed.oracleText}
                  className="leading-relaxed whitespace-pre-wrap"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No oracle text.</p>
              )}

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Meta label="Layout" value={card.layout} />
                <Meta
                  label="Colors"
                  value={card.colors != null ? <ColorIdentity colors={card.colors} /> : null}
                />
                <Meta
                  label="Color identity"
                  value={
                    card.colorIdentity != null ? (
                      <ColorIdentity colors={card.colorIdentity} />
                    ) : null
                  }
                />
                <Meta
                  label="Keywords"
                  value={card.keywords?.length ? card.keywords.join(', ') : null}
                />
                <Meta
                  label="Legal in"
                  value={
                    card.legalities
                      ? DECK_FORMATS.filter((format) => card.legalities?.[format] === 'legal')
                          .map((format) => DECK_FORMAT_LABELS[format])
                          .join(', ') || 'None of Standard, Commander, Modern'
                      : null
                  }
                />
                <Meta
                  label="Commander"
                  value={
                    card.leadershipSkills
                      ? isLeadershipCommander(card.leadershipSkills)
                        ? 'Yes'
                        : 'No'
                      : null
                  }
                />
                <Meta
                  label="Reserved"
                  value={card.reserved === null ? null : card.reserved ? 'Yes' : 'No'}
                />
              </dl>

              {selectedPrinting ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {selectedPrinting.setName} ({selectedPrinting.setCode}) #
                    {selectedPrinting.collectorNumber}
                    {selectedPrinting.rarity ? ` · ${selectedPrinting.rarity}` : ''}
                  </p>
                  {selectedPrinting.finishes.length > 0 ? (
                    <p className="flex flex-wrap items-center gap-2">
                      <span>Finishes:</span>
                      <PrintingFinishes finishes={selectedPrinting.finishes} />
                    </p>
                  ) : null}
                  {selectedPrinting.artist ? <p>Illustrated by {selectedPrinting.artist}</p> : null}
                </div>
              ) : null}
            </div>
          </div>

          <section className="space-y-3" aria-labelledby="printings-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="printings-heading" className="font-heading text-xl">
                Printings
              </h2>
              <Badge variant="secondary">{card.printings.length}</Badge>
            </div>
            {card.printings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No printings found.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {card.printings.map((printing) => {
                  const active = printing.id === selectedPrinting?.id;
                  return (
                    <li key={printing.id}>
                      <button
                        type="button"
                        onClick={() => selectPrinting(printing)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 ${
                          active ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="relative isolate size-10 shrink-0 overflow-hidden rounded bg-muted">
                          {printing.imageNormal ? (
                            <img
                              src={printing.imageNormal}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          {printingHasFoilTreatment(printing.finishes) ? (
                            <div
                              className="foil-sheen pointer-events-none absolute inset-0"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {printing.setName}{' '}
                            <span className="font-normal text-muted-foreground">
                              ({printing.setCode})
                            </span>
                          </p>
                          <p className="truncate text-muted-foreground">
                            #{printing.collectorNumber}
                            {printing.rarity ? ` · ${printing.rarity}` : ''}
                            {printing.releasedAt ? ` · ${printing.releasedAt}` : ''}
                          </p>
                          {printing.finishes.length > 0 ? (
                            <p className="truncate text-muted-foreground">
                              <PrintingFinishes finishes={printing.finishes} />
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
};

const Meta = ({ label, value }: { label: string; value: ReactNode }) => {
  if (value == null || value === '') return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
};
