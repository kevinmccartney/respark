import type { z } from 'zod';

const defaultApiBase = 'http://localhost:3000';

export const apiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  // Falling back to localhost in a deployed bundle silently points every user at
  // their own machine, so treat a missing value as a build misconfiguration.
  if (import.meta.env.PROD) {
    throw new Error('Missing VITE_API_URL. Production builds must set the API origin.');
  }

  return defaultApiBase;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type GetToken = () => Promise<string | null>;

export const apiFetch = async (
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<Response> => {
  const token = await getToken();
  if (!token) {
    throw new ApiError('Sign in required', 401);
  }

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(`${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  });
};

export const apiFetchJson = async <S extends z.ZodType>(
  path: string,
  getToken: GetToken,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> => {
  const response = await apiFetch(path, getToken, init);

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiError('API returned a non-JSON body', response.status);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(`Invalid API response: ${parsed.error.message}`, response.status);
  }

  return parsed.data;
};

/** Nest error responses carry a `message` worth surfacing; fall back to the status text. */
const errorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message) return body.message;
    if (Array.isArray(body.message) && body.message.length) return String(body.message[0]);
  } catch {
    // Response had no JSON body.
  }

  return response.statusText || 'Request failed';
};
