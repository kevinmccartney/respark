import { ManaText } from './ManaText.js';

export const ManaCost = ({
  cost,
  className,
  size = 16,
}: {
  cost: string | null | undefined;
  className?: string;
  size?: number;
}) => {
  if (!cost) return null;

  return (
    <ManaText
      text={cost}
      size={size}
      className={
        className
          ? `inline-flex items-center gap-0.5 ${className}`
          : 'inline-flex items-center gap-0.5'
      }
    />
  );
};
