import { CARD_SEARCH_RARITIES, type CardSearchRarity } from 'schemas/cards';
import { cn } from '@/core';

const RARITY_LABELS: Record<CardSearchRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
  special: 'Special',
  bonus: 'Bonus',
};

export const RarityFilter = ({
  value,
  onChange,
}: {
  value: CardSearchRarity[];
  onChange: (next: CardSearchRarity[]) => void;
}) => {
  const toggle = (rarity: CardSearchRarity) => {
    onChange(
      value.includes(rarity) ? value.filter((entry) => entry !== rarity) : [...value, rarity],
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rarity">
      {CARD_SEARCH_RARITIES.map((rarity) => {
        const active = value.includes(rarity);
        return (
          <button
            key={rarity}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(rarity)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm ring-1 transition-colors',
              active
                ? 'bg-muted font-medium ring-foreground/40'
                : 'ring-foreground/10 text-muted-foreground hover:text-foreground',
            )}
          >
            {RARITY_LABELS[rarity]}
          </button>
        );
      })}
    </div>
  );
};
