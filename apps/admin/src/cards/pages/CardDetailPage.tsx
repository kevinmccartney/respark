import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import {
  DECK_FORMATS,
  formatPrintingFinishes,
  isLeadershipCommander,
  uuidSchema,
  type CardPrintingSummary,
  type DeckFormat,
} from '@respark/schemas';
import { Badge } from '@respark/ui/lib';
import { ManaCost, ManaText } from '@respark/ui/mana';

import { useCard } from '@respark-admin/cards/hooks';
import { DetailShell } from '@respark-admin/core/components';
import { adminQueryErrorState } from '@respark-admin/core/lib';
const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
};

export const CardDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const printingParam = searchParams.get('printing');

  const validId = uuidSchema.safeParse(id).success;
  const { data: card, isPending, error } = useCard(id);
  const { notFound } = adminQueryErrorState(error, 'Could not load card');

  const selectedPrinting = useMemo(() => {
    if (!card || card.printings.length === 0) {
      return null;
    }
    return card.printings.find((printing) => printing.id === printingParam) ?? card.printings[0];
  }, [card, printingParam]);

  const selectPrinting = (printing: CardPrintingSummary) => {
    const next = new URLSearchParams(searchParams);
    if (card && printing.id === card.printings[0]?.id) {
      next.delete('printing');
    } else {
      next.set('printing', printing.id);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <DetailShell
      maxWidth="5xl"
      notFound={
        !validId || notFound
          ? {
              title: 'Card not found',
              description: 'That card is not in the catalog. Typo or bug? You decide!',
            }
          : null
      }
      error={error}
      errorFallback="Could not load card"
      loading={isPending}
      loadingLabel="Loading card…"
    >
      {!isPending && card ? (
        <div className="space-y-8">
          <div className="grid gap-8 md:grid-cols-[minmax(0,240px)_1fr]">
            <div className="overflow-hidden rounded-lg bg-muted">
              {selectedPrinting?.imageNormal || selectedPrinting?.imageLarge ? (
                <img
                  src={selectedPrinting.imageLarge ?? selectedPrinting.imageNormal ?? ''}
                  alt={card.name}
                  className="w-full"
                />
              ) : (
                <div className="flex aspect-5/7 items-center justify-center text-sm text-muted-foreground">
                  No image
                </div>
              )}
            </div>

            <div className="space-y-4">
              <header className="space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="font-heading text-3xl tracking-tight">{card.name}</h1>
                  {card.manaCost ? <ManaCost cost={card.manaCost} size={18} /> : null}
                </div>
                {card.typeLine ? <p className="text-muted-foreground">{card.typeLine}</p> : null}
              </header>

              {card.oracleText ? (
                <ManaText text={card.oracleText} className="leading-relaxed whitespace-pre-wrap" />
              ) : (
                <p className="text-sm text-muted-foreground">No oracle text.</p>
              )}

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Meta
                  label="Keywords"
                  value={card.keywords?.length ? card.keywords.join(', ') : null}
                />
                <Meta
                  label="Color identity"
                  value={card.colorIdentity?.length ? card.colorIdentity.join(', ') : null}
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
                <Meta label="EDHREC rank" value={card.edhrecRank?.toString() ?? null} />
                <Meta label="EDHREC salt" value={card.edhrecSaltiness?.toString() ?? null} />
                <Meta
                  label="Game changer"
                  value={card.isGameChanger === null ? null : card.isGameChanger ? 'Yes' : 'No'}
                />
                <Meta
                  label="Goodstuff"
                  value={card.goodstuff ? card.goodstuff.tags.join(', ') || 'Flagged' : null}
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
                    <p>Finishes: {formatPrintingFinishes(selectedPrinting.finishes)}</p>
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
        </div>
      ) : null}
    </DetailShell>
  );
};

const Meta = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) {
    return null;
  }
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
};
