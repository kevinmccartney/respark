/** Provider pipelines that ingest into Postgres. */
export type EtlSource = 'scryfall' | 'mtgjson' | 'justtcg'

/** Non-source CLI verbs (orchestration + ops). */
export type EtlUtilityCommand = 'all' | 'report' | 'forecast' | 'ping'

export type EtlCommand = EtlSource | EtlUtilityCommand

export const ETL_SOURCES = ['scryfall', 'mtgjson', 'justtcg'] as const satisfies readonly EtlSource[]

export const ETL_UTILITY_COMMANDS = [
  'all',
  'report',
  'forecast',
  'ping',
] as const satisfies readonly EtlUtilityCommand[]

export type IngestionRunStatus = 'running' | 'success' | 'partial_success' | 'failed'

export type GlobalFlags = {
  limit?: number
  dryRun: boolean
  verbose: boolean
  storeRaw?: boolean
}
