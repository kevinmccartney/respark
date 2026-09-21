import type { ReactNode } from 'react';
import type { SortDir } from 'schemas/primitives';
import { TableHead } from '@/core/ui/table';
import { cn } from '@/core';

export const SortableHead = ({
  active,
  dir,
  onClick,
  children,
  className,
}: {
  active: boolean;
  dir?: SortDir;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) => (
  <TableHead
    aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
    className={className}
  >
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left font-medium hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
      <span className={cn('text-xs', active ? 'opacity-100' : 'opacity-40')} aria-hidden>
        {active ? (dir === 'desc' ? '↓' : '↑') : '↕'}
      </span>
    </button>
  </TableHead>
);
