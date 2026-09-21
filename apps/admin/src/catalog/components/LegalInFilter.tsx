import { DECK_FORMATS, type DeckFormat } from 'schemas/decks';
import { cn } from '@/core';

const FORMAT_LABELS: Record<DeckFormat, string> = {
  standard: 'Standard',
  commander: 'Commander',
  modern: 'Modern',
};

export const LegalInFilter = ({
  value,
  onChange,
}: {
  value: DeckFormat[];
  onChange: (next: DeckFormat[]) => void;
}) => {
  const toggle = (format: DeckFormat) => {
    onChange(
      value.includes(format) ? value.filter((entry) => entry !== format) : [...value, format],
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Legal in">
      {DECK_FORMATS.map((format) => {
        const active = value.includes(format);
        return (
          <button
            key={format}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(format)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm ring-1 transition-colors',
              active
                ? 'bg-muted font-medium ring-foreground/40'
                : 'ring-foreground/10 text-muted-foreground hover:text-foreground',
            )}
          >
            {FORMAT_LABELS[format]}
          </button>
        );
      })}
    </div>
  );
};
