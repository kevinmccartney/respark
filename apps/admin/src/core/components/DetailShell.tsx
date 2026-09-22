import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@respark/ui/lib';

import { AdminLoadErrorAlert } from '@respark-admin/core/components';
import { NotFoundPage } from '@respark-admin/core/pages';

type DetailShellProps = {
  maxWidth?: '5xl' | '6xl';
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
  notFound = null,
  error,
  errorFallback,
  loading = false,
  loadingLabel = 'Loading…',
  children,
}: DetailShellProps) => {
  const navigate = useNavigate();

  if (notFound) {
    return <NotFoundPage title={notFound.title} description={notFound.description} />;
  }

  return (
    <main className={`mx-auto ${MAX_WIDTH_CLASS[maxWidth]} px-5 py-5`}>
      <div className="mb-4">
        <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <AdminLoadErrorAlert error={error} fallback={errorFallback} />

      {loading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loadingLabel}
        </p>
      ) : null}

      {children}
    </main>
  );
};
