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
