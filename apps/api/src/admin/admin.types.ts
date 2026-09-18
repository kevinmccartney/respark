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
