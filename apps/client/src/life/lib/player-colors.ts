import type { PlayerColor } from './game-storage';

// Full class strings so Tailwind can see them.
export const COLOR_STYLES: Record<PlayerColor, { label: string; panel: string; swatch: string }> = {
  colorless: { label: 'Colorless', panel: 'bg-card', swatch: 'bg-stone-300 dark:bg-stone-500' },
  white: {
    label: 'White',
    panel:
      'border-amber-200 bg-amber-50 text-stone-900 dark:border-amber-100/25 dark:bg-amber-50/15 dark:text-amber-50',
    swatch: 'bg-amber-50',
  },
  blue: {
    label: 'Blue',
    panel: 'border-sky-300 bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60',
    swatch: 'bg-sky-500',
  },
  black: {
    label: 'Black',
    panel: 'border-zinc-700 bg-zinc-800 text-zinc-50 dark:bg-zinc-950',
    swatch: 'bg-zinc-900',
  },
  red: {
    label: 'Red',
    panel: 'border-red-300 bg-red-100 dark:border-red-800 dark:bg-red-950/60',
    swatch: 'bg-red-500',
  },
  green: {
    label: 'Green',
    panel: 'border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60',
    swatch: 'bg-emerald-500',
  },
};
