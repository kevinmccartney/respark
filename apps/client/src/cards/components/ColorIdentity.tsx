import { ManaCost } from '@respark/ui/mana';

export const ColorIdentity = ({
  colors,
  className,
  size = 16,
}: {
  colors: readonly string[];
  className?: string;
  size?: number;
}) => {
  const cost = colors.length === 0 ? '{C}' : colors.map((color) => `{${color}}`).join('');
  return <ManaCost cost={cost} className={className} size={size} />;
};
