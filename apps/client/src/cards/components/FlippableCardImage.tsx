import { RotateCw } from 'lucide-react';

import { Button } from '@respark/ui/lib';
export const FlippableCardImage = ({
  src,
  alt,
  foil = false,
  canFlip,
  nextFaceName,
  onFlip,
}: {
  src: string | null;
  alt: string;
  foil?: boolean;
  canFlip: boolean;
  nextFaceName: string;
  onFlip: () => void;
}) => (
  <div className="relative isolate overflow-hidden rounded-md bg-muted">
    {src ? (
      <img src={src} alt={alt} className="h-auto w-full" />
    ) : (
      <div className="flex aspect-5/7 items-center justify-center p-6 text-sm text-muted-foreground">
        No image
      </div>
    )}
    {foil ? <div className="foil-sheen pointer-events-none absolute inset-0" aria-hidden /> : null}
    {canFlip ? (
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="absolute right-2 bottom-2 z-10 shadow-md"
        aria-label={`Show ${nextFaceName}`}
        onClick={onFlip}
      >
        <RotateCw />
      </Button>
    ) : null}
  </div>
);
