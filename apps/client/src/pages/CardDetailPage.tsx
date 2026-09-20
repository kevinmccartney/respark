import { useAuth } from '@clerk/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isLeadershipCommander } from 'schemas/cards';
import { uuidSchema } from 'schemas/primitives';
import { ManaCost, ManaText } from 'ui/mana';
import { FlippableCardImage } from '../components/FlippableCardImage.tsx';
import { ApiError, isAbortError, isNotFound } from '../lib/api.ts';
import { resolveCardFace } from '../lib/card-faces.ts';
import { fetchCard, type CardDetail, type CardPrintingSummary } from '../lib/cards.ts';
import { DECK_FORMAT_LABELS, DECK_FORMATS } from '../lib/decks.ts';
import { goBackOrHome } from '../lib/navigation.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

export const CardDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const printingParam = searchParams.get('printing');

  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      setCard(null);
      if (!uuidSchema.safeParse(id).success) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const detail = await fetchCard(getToken, id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setCard(detail);
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return;
        if (isNotFound(err)) {
          setNotFound(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load card');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (id) void load();
    return () => controller.abort();
  }, [getToken, id]);

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
        <Button type="button" variant="outline" size="sm" onClick={() => goBackOrHome(navigate)}>
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
                <Meta label="Colors" value={card.colors?.length ? card.colors.join(', ') : null} />
                <Meta
                  label="Color identity"
                  value={card.colorIdentity?.length ? card.colorIdentity.join(', ') : null}
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
                        <div className="size-10 shrink-0 overflow-hidden rounded bg-muted">
                          {printing.imageNormal ? (
                            <img
                              src={printing.imageNormal}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
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

const Meta = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
};
