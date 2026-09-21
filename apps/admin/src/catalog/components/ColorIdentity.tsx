import type { ColorIdentityPip } from 'schemas/decks';
import { ManaCost } from 'ui/mana';

export const ColorIdentity = ({
  colors,
  className,
  size = 14,
}: {
  colors: readonly string[] | null | undefined;
  className?: string;
  size?: number;
}) => {
  const pips = (colors ?? []).filter(
    (color): color is ColorIdentityPip =>
      color === 'W' || color === 'U' || color === 'B' || color === 'R' || color === 'G',
  );
  if (pips.length === 0) {
    return <ManaCost cost="{C}" className={className} size={size} />;
  }
  return (
    <ManaCost cost={pips.map((color) => `{${color}}`).join('')} className={className} size={size} />
  );
};
