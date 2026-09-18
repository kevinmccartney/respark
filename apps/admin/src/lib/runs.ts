import { ApiError, apiFetchJson } from './api.ts'

export type IngestionRun = {
  id: string
  source: string
  status: string
  startedAt: string
  completedAt: string | null
  sourceVersion: string | null
  sourceUrl: string | null
  recordsSeen: number
  recordsInserted: number
  recordsUpdated: number
  recordsUnchanged: number
  recordsFailed: number
  downloadBytes: number | null
  durationMs: number | null
  errorMessage: string | null
}

export type IngestionError = {
  id: number
  runId: string
  source: string
  externalId: string | null
  stage: string
  errorMessage: string
  payload: unknown
  createdAt: string
}

/** Display labels sent to POST /admin/etl-job (API normalizes case). */
export const ETL_JOB_SOURCES = [
  { value: 'Scryfall', implemented: true },
  { value: 'MTGJSON', implemented: false },
  { value: 'JustTCG', implemented: false },
] as const

type GetToken = () => Promise<string | null>

export async function fetchIngestionRuns(
  getToken: GetToken,
  opts?: { limit?: number; source?: string; status?: string },
): Promise<IngestionRun[]> {
  const params = new URLSearchParams()
  if (opts?.limit != null) params.set('limit', String(opts.limit))
  if (opts?.source) params.set('source', opts.source)
  if (opts?.status) params.set('status', opts.status)
  const qs = params.toString()
  const path = qs ? `/admin/ingestion-runs?${qs}` : '/admin/ingestion-runs'
  const body = await apiFetchJson<{ runs: IngestionRun[] }>(path, getToken)
  return body.runs
}

export async function fetchIngestionRun(
  getToken: GetToken,
  id: string,
): Promise<IngestionRun> {
  const body = await apiFetchJson<{ run: IngestionRun }>(
    `/admin/ingestion-runs/${id}`,
    getToken,
  )
  return body.run
}

export async function fetchIngestionErrors(
  getToken: GetToken,
  runId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ errors: IngestionError[]; total: number }> {
  const params = new URLSearchParams()
  if (opts?.limit != null) params.set('limit', String(opts.limit))
  if (opts?.offset != null) params.set('offset', String(opts.offset))
  const qs = params.toString()
  const path = qs
    ? `/admin/ingestion-runs/${runId}/errors?${qs}`
    : `/admin/ingestion-runs/${runId}/errors`
  return apiFetchJson<{ errors: IngestionError[]; total: number }>(path, getToken)
}

export async function startEtlJob(
  getToken: GetToken,
  source: string,
): Promise<{ accepted: true; source: string }> {
  return apiFetchJson<{ accepted: true; source: string }>('/admin/etl-job', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403
}
