import { CARD_SEARCH_COLOR_FILTERS, type CardSearchColorFilter } from 'schemas/cards';
import { ManaCost } from 'ui/mana';
import { cn } from '@/core';

export const ColorIdentityFilter = ({
  value,
  onChange,
}: {
  value: CardSearchColorFilter[];
  onChange: (next: CardSearchColorFilter[]) => void;
}) => {
  const toggle = (pip: CardSearchColorFilter) => {
    onChange(value.includes(pip) ? value.filter((entry) => entry !== pip) : [...value, pip]);
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Color identity">
      {CARD_SEARCH_COLOR_FILTERS.map((pip) => {
        const active = value.includes(pip);
        return (
          <button
            key={pip}
            type="button"
            aria-pressed={active}
            title={pip === 'C' ? 'Colorless' : pip}
            onClick={() => toggle(pip)}
            className={cn(
              'rounded-md p-1.5 ring-1 transition-colors',
              active
                ? 'bg-muted ring-foreground/40'
                : 'ring-foreground/10 opacity-45 hover:opacity-80',
            )}
          >
            <ManaCost cost={`{${pip}}`} size={18} />
          </button>
        );
      })}
    </div>
  );
};
