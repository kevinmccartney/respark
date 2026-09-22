import { Alert, AlertDescription } from '@respark/ui/lib';

import { ADMIN_FORBIDDEN_MESSAGE, apiErrorMessage, isForbidden } from '../lib/errors';

type AdminLoadErrorAlertProps = {
  error: unknown | null | undefined;
  fallback: string;
};

export const AdminLoadErrorAlert = ({ error, fallback }: AdminLoadErrorAlertProps) => {
  if (!error) {
    return null;
  }

  const forbidden = isForbidden(error);
  const message = forbidden ? ADMIN_FORBIDDEN_MESSAGE : apiErrorMessage(error, fallback);

  return (
    <Alert variant={forbidden ? 'destructive' : 'default'} className="mb-3">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
};
