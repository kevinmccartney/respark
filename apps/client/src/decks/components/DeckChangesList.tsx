import { cn } from 'cn';

import type { DeckChanges } from '@respark/schemas/deck-revisions';

import {
  CARD_CHANGE_HEADINGS,
  cardChangeQuantityParts,
  describeDetailChange,
  describeStackPrinting,
} from '../lib/deck-changes';

import { DeckChangeCardName } from './DeckChangeCardName';

const CARD_CHANGE_ORDER = ['added', 'removed', 'updated'] as const;

type ChangeTone = 'added' | 'removed' | 'updated';

const TONE_TEXT: Record<ChangeTone, string> = {
  added: 'text-emerald-700 dark:text-emerald-400',
  removed: 'text-destructive',
  updated: 'text-amber-700 dark:text-amber-400',
};

const TONE_MARKER: Record<ChangeTone, string> = {
  added: '+',
  removed: '−',
  updated: '~',
};

const ChangeHeading = ({ tone, children }: { tone: ChangeTone; children: string }) => (
  <h4 className={cn('text-xs font-medium tracking-wide uppercase', TONE_TEXT[tone])}>{children}</h4>
);

const ChangeLine = ({ tone, children }: { tone: ChangeTone; children: React.ReactNode }) => (
  <li className="flex gap-2 break-words">
    <span
      aria-hidden
      className={cn('w-3 shrink-0 text-center font-mono font-semibold', TONE_TEXT[tone])}
    >
      {TONE_MARKER[tone]}
    </span>
    <span className="min-w-0">{children}</span>
  </li>
);

export const DeckChangesList = ({ changes }: { changes: DeckChanges }) => (
  <div className="space-y-3 text-sm">
    {changes.details.length > 0 ? (
      <section className="space-y-1">
        <ChangeHeading tone="updated">Deck details</ChangeHeading>
        <ul className="space-y-0.5">
          {changes.details.map((change) => (
            <ChangeLine key={change.field} tone="updated">
              {describeDetailChange(change)}
            </ChangeLine>
          ))}
        </ul>
      </section>
    ) : null}
    {CARD_CHANGE_ORDER.map((kind) => {
      const entries = changes.cards.filter((change) => change.kind === kind);
      if (entries.length === 0) return null;
      return (
        <section key={kind} className="space-y-1">
          <ChangeHeading tone={kind}>{CARD_CHANGE_HEADINGS[kind]}</ChangeHeading>
          <ul className="space-y-0.5">
            {entries.map((change) => (
              <ChangeLine
                key={`${change.printingId}-${change.foil}-${change.sideboard}`}
                tone={kind}
              >
                {cardChangeQuantityParts(change).before}
                <DeckChangeCardName change={change} /> ({describeStackPrinting(change)})
                {cardChangeQuantityParts(change).after}
                {change.sideboard ? (
                  <span className="text-muted-foreground"> (sideboard)</span>
                ) : null}
              </ChangeLine>
            ))}
          </ul>
        </section>
      );
    })}
  </div>
);
