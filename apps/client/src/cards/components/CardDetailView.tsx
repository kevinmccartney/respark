import { type ReactNode, useEffect, useState } from 'react';

import {
  isLeadershipCommander,
  printingHasFoilTreatment,
  type CardDetail,
  type CardPrintingSummary,
} from '@respark/schemas/cards';
import { DECK_FORMATS, type DeckFormat } from '@respark/schemas/decks';
import { Badge } from '@respark/ui/lib';
import { ManaCost, ManaText } from '@respark/ui/mana';

import { resolveCardFace } from '../lib/card-faces';

import { ColorIdentity } from './ColorIdentity';
import { FlippableCardImage } from './FlippableCardImage';
import { PrintingFinishes } from './FoilMark';

const DECK_FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
};

type Props = {
  card: CardDetail;
  selectedPrinting: CardPrintingSummary | null;
  onSelectPrinting: (printing: CardPrintingSummary) => void;
  /** Heading level for the card name; `h1` on the page, `h2` inside a dialog. */
  titleAs?: 'h1' | 'h2';
  pageLink?: ReactNode;
};

/** Image, rules text, metadata, and printings list shared by the card page and card dialog. */
export const CardDetailView = ({
  card,
  selectedPrinting,
  onSelectPrinting,
  pageLink = null,
  titleAs: Title = 'h1',
}: Props) => {
  const SectionTitle = Title === 'h1' ? 'h2' : 'h3';
  const [faceIndex, setFaceIndex] = useState(0);

  useEffect(() => {
    setFaceIndex(0);
  }, [selectedPrinting?.id]);

  const faceView = resolveCardFace({
    faces: selectedPrinting?.faces ?? [],
    faceIndex,
    name: card.name,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    oracleText: card.oracleText,
    imageNormal: selectedPrinting?.imageNormal ?? null,
    imageLarge: selectedPrinting?.imageLarge ?? null,
    preferLarge: true,
  });
  const displayed = faceView.displayed;

  return (
    <>
      <div className="grid gap-8 md:grid-cols-[minmax(0,280px)_1fr]">
        <div className="flex flex-col gap-2">
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
          <div className="flex justify-center">{pageLink ? pageLink : null}</div>
        </div>

        <div className="space-y-4">
          <header className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Title className="font-heading text-3xl tracking-tight">{displayed.name}</Title>
              {displayed.manaCost ? <ManaCost cost={displayed.manaCost} size={18} /> : null}
            </div>
            {displayed.typeLine ? (
              <p className="text-muted-foreground">{displayed.typeLine}</p>
            ) : null}
          </header>

          {displayed.oracleText ? (
            <ManaText text={displayed.oracleText} className="leading-relaxed whitespace-pre-wrap" />
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
                card.colorIdentity != null ? <ColorIdentity colors={card.colorIdentity} /> : null
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

      <section className="space-y-3" aria-label="Printings">
        <div className="flex items-baseline justify-between gap-3">
          <SectionTitle className="font-heading text-xl">Printings</SectionTitle>
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
                    onClick={() => onSelectPrinting(printing)}
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
