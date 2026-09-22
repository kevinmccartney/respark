export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const ADMIN_FORBIDDEN_MESSAGE =
  'Your account is not an admin. Set publicMetadata.role to "admin" in Clerk.';

export const isForbidden = (err: unknown): boolean => err instanceof ApiError && err.status === 403;

export const isNotFound = (err: unknown): boolean => err instanceof ApiError && err.status === 404;

export const apiErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof ApiError) {
    return err.message;
  }

  return fallback;
};

export const adminQueryErrorState = (error: unknown | null | undefined, fallback: string) => {
  if (!error) {
    return { notFound: false, forbidden: false, message: null as string | null };
  }
  return {
    notFound: isNotFound(error),
    forbidden: isForbidden(error),
    message: isForbidden(error) ? ADMIN_FORBIDDEN_MESSAGE : apiErrorMessage(error, fallback),
  };
};

export const applyAdminLoadError = (
  err: unknown,
  setters: {
    setError: (message: string) => void;
    setForbidden?: (value: boolean) => void;
    setNotFound?: (value: boolean) => void;
  },
  fallback: string,
): void => {
  if (isForbidden(err)) {
    setters.setForbidden?.(true);
    setters.setError(ADMIN_FORBIDDEN_MESSAGE);
    return;
  }
  if (isNotFound(err)) {
    if (setters.setNotFound) {
      setters.setNotFound(true);
      return;
    }
  }
  setters.setError(apiErrorMessage(err, fallback));
};
