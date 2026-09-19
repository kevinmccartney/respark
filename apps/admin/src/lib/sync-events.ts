/** Mirrors apps/etl SyncEvent — keep in sync with the etl package stream-events. */
export type SyncEvent =
  | {
      type: 'sync.started'
      sync: {
        id: string
        status: string
        includeCatalog: boolean
        includeEnrichment: boolean
        enrichmentJobs: string[]
        startedAt: string
        completedAt: string | null
        errorMessage: string | null
      }
    }
  | {
      type: 'sync.updated'
      syncId: string
      status: string
      completedAt: string | null
      errorMessage: string | null
    }
  | {
      type: 'sync.completed'
      syncId: string
      status: string
      completedAt: string
      errorMessage: string | null
    }
  | {
      type: 'job.started'
      syncId: string
      jobRunId: string
      stage: string
      job: string
      status: string
      startedAt: string
    }
  | {
      type: 'job.updated'
      syncId: string
      jobRunId: string
      stage: string
      job: string
      status: string
      metrics: {
        recordsSeen: number
        recordsInserted: number
        recordsUpdated: number
        recordsUnchanged: number
        recordsFailed: number
        downloadBytes: number | null
        durationMs: number | null
      }
      errorMessage: string | null
    }
  | {
      type: 'job.completed'
      syncId: string
      jobRunId: string
      stage: string
      job: string
      status: string
      metrics: {
        recordsSeen: number
        recordsInserted: number
        recordsUpdated: number
        recordsUnchanged: number
        recordsFailed: number
        downloadBytes: number | null
        durationMs: number | null
      }
      completedAt: string
      errorMessage: string | null
    }
  | {
      type: 'job.progress'
      syncId: string
      jobRunId: string
      stage: string
      job: string
      progress: {
        current: number
        total: number | null
        cards: number
        inserted: number
        updated: number
        unchanged: number
        failed: number
        percent: number | null
      }
    }
  | {
      type: 'job.log'
      syncId: string
      jobRunId: string | null
      stage: string | null
      job: string | null
      level: 'info' | 'warn' | 'error' | 'debug'
      message: string
      fields?: Record<string, unknown>
    }
  | {
      type: 'job.error'
      syncId: string
      jobRunId: string
      error: {
        source: string
        externalId: string | null
        stage: string
        errorMessage: string
        payload?: unknown
      }
    }
  | {
      type: 'job.unmatched'
      syncId: string
      jobRunId: string
      unmatched: {
        externalId: string
        name: string | null
        setCode: string | null
        collectorNumber: string | null
        language: string | null
        scryfallId: string | null
        reason: string
      }
    }
