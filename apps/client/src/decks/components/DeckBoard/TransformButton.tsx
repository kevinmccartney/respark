import { RotateCw } from 'lucide-react';

export const TransformButton = ({
  transformed,
  onClick,
  className,
}: {
  transformed: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    title="Click to transform card"
    aria-label="Click to transform card"
    className={
      className ??
      (transformed
        ? 'shrink-0 text-primary hover:text-primary'
        : 'shrink-0 text-muted-foreground hover:text-foreground')
    }
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    <RotateCw className="size-3.5" />
  </button>
);
