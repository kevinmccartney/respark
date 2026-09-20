import type { ColorIdentityPip } from 'schemas/decks';
import { ManaCost } from 'ui/mana';

export const ColorIdentity = ({
  colors,
  className,
  size = 16,
}: {
  colors: ColorIdentityPip[];
  className?: string;
  size?: number;
}) => {
  if (colors.length === 0) return null;
  return (
    <ManaCost
      cost={colors.map((color) => `{${color}}`).join('')}
      className={className}
      size={size}
    />
  );
};
