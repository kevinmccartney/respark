import type { ComponentProps, ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

import { Button } from './lib/button.js';

const historyIndex = (state: unknown): number | null => {
  if (state && typeof state === 'object' && 'idx' in state && typeof state.idx === 'number') {
    return state.idx;
  }
  return null;
};

/** React Router records the stack index on history.state.idx. */
export const goBackOrFallback = (navigate: NavigateFunction, fallbackTo: string): void => {
  const idx = historyIndex(window.history.state);
  if (idx !== null && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallbackTo);
};

type BackButtonProps = {
  /** Path used when there is no in-app history to go back to. */
  fallbackTo: string;
  children?: ReactNode;
} & Pick<ComponentProps<typeof Button>, 'variant' | 'size' | 'className' | 'disabled'>;

export const BackButton = ({
  fallbackTo,
  children = 'Back',
  variant = 'default',
  size = 'sm',
  ...props
}: BackButtonProps) => {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => goBackOrFallback(navigate, fallbackTo)}
      {...props}
    >
      {children}
    </Button>
  );
};
