/** Sync stages. */
export type SyncStage = 'catalog' | 'enrichment'

/** Jobs inside a stage. Catalog stage has job `catalog`; enrichment has `identifiers`, … */
export type CatalogJob = 'catalog'
export type EnrichmentJob = 'identifiers'
export type SyncJob = CatalogJob | EnrichmentJob

export type IngestionRunStatus =
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed'

export type GlobalFlags = {
  limit?: number
  dryRun: boolean
  verbose: boolean
  storeRaw?: boolean
  /** Dev-only: inject synthetic unmatched/ambiguous MTGJSON cases (skips download). */
  demoMismatches?: boolean
}

/** Parent sync id for a job run. */
export type JobContext = {
  syncId: string
}
