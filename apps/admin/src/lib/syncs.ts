import { ApiError, apiFetchJson } from './api.ts'

export type EtlJobRun = {
  id: string
  syncId: string
  stage: string
  job: string
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

export type EtlStageView = {
  stage: string
  jobs: EtlJobRun[]
}

export type EtlSync = {
  id: string
  status: string
  includeCatalog: boolean
  includeEnrichment: boolean
  enrichmentJobs: string[]
  startedAt: string
  completedAt: string | null
  errorMessage: string | null
  createdAt: string
  stages: EtlStageView[]
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

export type IngestionReconciliation = {
  runId: string
  matched: number
  unmatched: number
  ambiguous: number
  identifiersAdded: number
  rawInserted: number | null
  rawUpdated: number | null
  rawUnchanged: number | null
  storeRaw: boolean | null
  demoMismatches: boolean
  dryRun: boolean
  limitN: number | null
  createdAt: string
}

export type IngestionUnmatched = {
  id: number
  runId: string
  externalId: string
  name: string | null
  setCode: string | null
  collectorNumber: string | null
  language: string | null
  scryfallId: string | null
  reason: string
  createdAt: string
}

export const JOB_LABELS: Record<string, string> = {
  catalog: 'Scryfall catalog',
  identifiers: 'Printing identifiers',
}

export const STAGE_LABELS: Record<string, string> = {
  catalog: 'Catalog',
  enrichment: 'Enrichment',
}

type GetToken = () => Promise<string | null>

export async function fetchEtlSyncs(
  getToken: GetToken,
  opts?: { limit?: number; status?: string },
): Promise<EtlSync[]> {
  const params = new URLSearchParams()
  if (opts?.limit != null) params.set('limit', String(opts.limit))
  if (opts?.status) params.set('status', opts.status)
  const qs = params.toString()
  const path = qs ? `/admin/etl-syncs?${qs}` : '/admin/etl-syncs'
  const body = await apiFetchJson<{ syncs: EtlSync[] }>(path, getToken)
  return body.syncs
}

export async function fetchEtlSync(
  getToken: GetToken,
  id: string,
): Promise<EtlSync> {
  const body = await apiFetchJson<{ sync: EtlSync }>(
    `/admin/etl-syncs/${id}`,
    getToken,
  )
  return body.sync
}

export async function fetchJobErrors(
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ errors: IngestionError[]; total: number }> {
  const params = new URLSearchParams()
  if (opts?.limit != null) params.set('limit', String(opts.limit))
  if (opts?.offset != null) params.set('offset', String(opts.offset))
  const qs = params.toString()
  const path = qs
    ? `/admin/etl-syncs/${syncId}/jobs/${jobRunId}/errors?${qs}`
    : `/admin/etl-syncs/${syncId}/jobs/${jobRunId}/errors`
  return apiFetchJson<{ errors: IngestionError[]; total: number }>(
    path,
    getToken,
  )
}

export async function fetchJobReconciliation(
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
): Promise<IngestionReconciliation | null> {
  const body = await apiFetchJson<{
    reconciliation: IngestionReconciliation | null
  }>(`/admin/etl-syncs/${syncId}/jobs/${jobRunId}/reconciliation`, getToken)
  return body.reconciliation
}

export async function fetchJobUnmatched(
  getToken: GetToken,
  syncId: string,
  jobRunId: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ unmatched: IngestionUnmatched[]; total: number }> {
  const params = new URLSearchParams()
  if (opts?.limit != null) params.set('limit', String(opts.limit))
  if (opts?.offset != null) params.set('offset', String(opts.offset))
  const qs = params.toString()
  const path = qs
    ? `/admin/etl-syncs/${syncId}/jobs/${jobRunId}/unmatched?${qs}`
    : `/admin/etl-syncs/${syncId}/jobs/${jobRunId}/unmatched`
  return apiFetchJson<{ unmatched: IngestionUnmatched[]; total: number }>(
    path,
    getToken,
  )
}

export async function startEtlSync(
  getToken: GetToken,
  input: { catalog: boolean; enrichmentJobs: string[] },
): Promise<{ accepted: true; catalog: boolean; enrichmentJobs: string[] }> {
  return apiFetchJson<{
    accepted: true
    catalog: boolean
    enrichmentJobs: string[]
  }>('/admin/etl-syncs', getToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function syncStagesLabel(sync: EtlSync): string {
  const parts: string[] = []
  if (sync.includeCatalog) parts.push('Catalog')
  if (sync.includeEnrichment) {
    const jobs =
      sync.enrichmentJobs.length > 0
        ? sync.enrichmentJobs.map((j) => JOB_LABELS[j] ?? j).join(', ')
        : 'Enrichment'
    parts.push(jobs)
  }
  return parts.length > 0 ? parts.join(' + ') : '—'
}

export function syncDurationMs(sync: EtlSync): number | null {
  if (!sync.completedAt) return null
  const start = Date.parse(sync.startedAt)
  const end = Date.parse(sync.completedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.max(0, end - start)
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403
}
