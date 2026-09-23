import { cn } from 'cn';
import type { ReactNode } from 'react';

import { BackButton } from '@respark/ui/back-button';

import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import { NotFoundPage } from '@respark-admin/core/pages';

type DetailShellProps = {
  maxWidth?: '5xl' | '6xl';
  /** Fill the AppShell outlet and let children manage scroll. */
  fill?: boolean;
  notFound?: { title: string; description: string } | null;
  error: unknown | null | undefined;
  errorFallback: string;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

const MAX_WIDTH_CLASS = {
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
} as const;

export const DetailShell = ({
  maxWidth = '6xl',
  fill = false,
  notFound = null,
  error,
  errorFallback,
  loading = false,
  loadingLabel = 'Loading…',
  children,
}: DetailShellProps) => {
  if (notFound) {
    return <NotFoundPage title={notFound.title} description={notFound.description} />;
  }

  return (
    <main
      className={cn(
        'mx-auto w-full px-5 py-5',
        MAX_WIDTH_CLASS[maxWidth],
        fill && 'flex h-full min-h-0 flex-col overflow-hidden',
      )}
    >
      <div className={cn('mb-4', fill && 'shrink-0')}>
        <BackButton fallbackTo="/" />
      </div>

      <div className={cn(fill && 'shrink-0')}>
        <AdminLoadErrorAlert error={error} fallback={errorFallback} />
      </div>

      {loading ? (
        <p className={cn('text-sm text-muted-foreground', fill && 'shrink-0')} aria-live="polite">
          {loadingLabel}
        </p>
      ) : null}

      {fill ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        children
      )}
    </main>
  );
};
