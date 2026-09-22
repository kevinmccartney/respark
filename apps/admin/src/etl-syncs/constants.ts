export const PAGE_SIZE = 50;

export const SYNC_LOGS_LIMIT = 200;

export const LIVE_LOG_LIMIT = 200;

export const STAGE_ORDER = ['catalog', 'enrichment'] as const;

export const JOB_LABELS: Record<string, string> = {
  catalog: 'Scryfall catalog',
  identifiers: 'Printing identifiers',
};

export const STAGE_LABELS: Record<string, string> = {
  catalog: 'Catalog',
  enrichment: 'Enrichment',
};
