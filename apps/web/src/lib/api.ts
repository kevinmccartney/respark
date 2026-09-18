const defaultApiBase = 'http://localhost:3000'

export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (!configured) return defaultApiBase
  return configured.replace(/\/$/, '')
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type GetToken = () => Promise<string | null>

export async function apiFetch(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken()
  if (!token) {
    throw new ApiError('Sign in required', 401)
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return fetch(`${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  })
}

export async function apiFetchJson<T>(
  path: string,
  getToken: GetToken,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, getToken, init)

  if (!response.ok) {
    throw new ApiError(response.statusText || 'Request failed', response.status)
  }

  return response.json() as Promise<T>
}
