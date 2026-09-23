import * as React from 'react';
import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { MoreHorizontalIcon } from 'lucide-react';

import { Button } from './button.js';
import { Input } from './input.js';

function PaginationComponent({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex items-center gap-1', className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>;

function PaginationLink({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? 'outline' : 'ghost'}
      size={size}
      className={cn(className)}
      nativeButton={false}
      render={
        <a
          aria-current={isActive ? 'page' : undefined}
          data-slot="pagination-link"
          data-active={isActive}
          {...props}
        />
      }
    />
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export type PaginationProps = {
  /** 1-based current page */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
  /**
   * Pages shown on each side of the current page.
   * Defaults to 0 below the `sm` breakpoint and 2 at `sm` and up.
   */
  siblingCount?: number;
  /** Pages always shown at the start and end (default 1). */
  boundaryCount?: number;
};

const SM_MIN_WIDTH_QUERY = '(min-width: 640px)';

const useSmUp = () => {
  const [smUp, setSmUp] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia(SM_MIN_WIDTH_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(SM_MIN_WIDTH_QUERY);
    const onChange = () => setSmUp(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return smUp;
};

const range = (start: number, end: number): number[] => {
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

/**
 * Build a page list with truncation in the middle, e.g. `1 … 8 9 10 … 20`.
 */
export const buildPaginationItems = (
  page: number,
  totalPages: number,
  siblingCount = 2,
  boundaryCount = 1,
): Array<number | 'ellipsis'> => {
  if (totalPages <= 0) return [];

  const safePage = Math.min(Math.max(1, page), totalPages);
  const safeSibling = Math.max(0, siblingCount);
  const safeBoundary = Math.max(1, boundaryCount);

  // boundaries + siblings around current + current + up to 2 ellipses
  const maxVisible = safeBoundary * 2 + safeSibling * 2 + 3;
  if (totalPages <= maxVisible) {
    return range(1, totalPages);
  }

  const startPages = range(1, safeBoundary);
  const endPages = range(totalPages - safeBoundary + 1, totalPages);

  const siblingsStart = Math.max(
    Math.min(safePage - safeSibling, totalPages - safeBoundary - safeSibling * 2 - 1),
    safeBoundary + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(safePage + safeSibling, safeBoundary + safeSibling * 2 + 2),
    endPages[0]! - 2,
  );

  const items: Array<number | 'ellipsis'> = [...startPages];

  if (siblingsStart > safeBoundary + 2) {
    items.push('ellipsis');
  } else if (safeBoundary + 1 < endPages[0]!) {
    items.push(safeBoundary + 1);
  }

  items.push(...range(siblingsStart, siblingsEnd));

  if (siblingsEnd < totalPages - safeBoundary - 1) {
    items.push('ellipsis');
  } else if (totalPages - safeBoundary > safeBoundary) {
    items.push(totalPages - safeBoundary);
  }

  items.push(...endPages);
  return items;
};

export const Pagination = ({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  className,
  siblingCount,
  boundaryCount = 1,
}: PaginationProps) => {
  const [gotoDraft, setGotoDraft] = useState(String(page));
  const smUp = useSmUp();
  const resolvedSiblingCount = siblingCount ?? (smUp ? 2 : 0);

  useEffect(() => {
    setGotoDraft(String(page));
  }, [page]);

  if (totalPages <= 1) return null;

  const items = buildPaginationItems(page, totalPages, resolvedSiblingCount, boundaryCount);
  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  const submitGoto = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number.parseInt(gotoDraft.trim(), 10);
    if (!Number.isFinite(parsed)) {
      setGotoDraft(String(page));
      return;
    }
    const next = Math.min(Math.max(1, Math.floor(parsed)), totalPages);
    setGotoDraft(String(next));
    if (next !== page) onPageChange(next);
  };

  return (
    <PaginationComponent className={cn('mt-3 justify-center', className)}>
      <PaginationContent className="mx-0 flex-wrap justify-center">
        <PaginationItem>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atStart || disabled}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
        </PaginationItem>
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <Button
                type="button"
                variant={item === page ? 'default' : 'ghost'}
                size="icon-sm"
                disabled={disabled}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={item === page ? 'font-semibold tabular-nums' : 'tabular-nums'}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atEnd || disabled}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </PaginationItem>
        <PaginationItem className="flex basis-full justify-center sm:ml-1 sm:basis-auto">
          <form className="flex items-center gap-1.5" onSubmit={submitGoto} aria-label="Go to page">
            <label htmlFor="offset-pagination-goto" className="text-sm text-muted-foreground">
              Go to
            </label>
            <Input
              id="offset-pagination-goto"
              type="number"
              inputMode="numeric"
              min={1}
              max={totalPages}
              value={gotoDraft}
              disabled={disabled}
              onChange={(event) => setGotoDraft(event.target.value)}
              className="h-7 w-16 rounded-md px-2 text-center tabular-nums"
              aria-label={`Page number, 1 to ${totalPages}`}
            />
            <Button type="submit" variant="default" size="sm" disabled={disabled}>
              Go
            </Button>
          </form>
        </PaginationItem>
      </PaginationContent>
    </PaginationComponent>
  );
};
