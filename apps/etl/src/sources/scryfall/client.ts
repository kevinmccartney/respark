import type { Logger } from '../../core/logger';

import {
  bulkByteSize,
  bulkDataListSchema,
  bulkDownloadUri,
  scryfallSetListSchema,
  type BulkDataItem,
  type ScryfallSet,
} from './schema';

const BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';
const SETS_URL = 'https://api.scryfall.com/sets';

/** Scryfall asks for a descriptive User-Agent on automated requests. */
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'respark-etl/0.1 (MTG catalog pipeline)',
} as const;

/** Prefer default_cards: one object per unique English-ish printing. */
export const PREFERRED_BULK_TYPE = 'default_cards';

export const fetchBulkMetadata = async (logger: Logger): Promise<BulkDataItem[]> => {
  logger.info(
    { event: 'scryfall.bulk_meta.fetch', url: BULK_DATA_URL },
    'Fetching Scryfall bulk metadata',
  );
  const response = await fetch(BULK_DATA_URL, { headers: DEFAULT_HEADERS });
  if (!response.ok) {
    throw new Error(`Scryfall bulk-data HTTP ${response.status}: ${await response.text()}`);
  }

  const json: unknown = await response.json();
  const parsed = bulkDataListSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Unexpected Scryfall bulk-data document: ${parsed.error.message}`);
  }

  logger.info(
    { event: 'scryfall.bulk_meta.ok', count: parsed.data.data.length },
    'Fetched Scryfall bulk metadata',
  );
  return parsed.data.data;
};

export const selectBulkDataset = (
  items: BulkDataItem[],
  type: string = PREFERRED_BULK_TYPE,
): BulkDataItem => {
  const match = items.find((item) => item.type === type);
  if (!match) {
    const available = items.map((i) => i.type).join(', ');
    throw new Error(`Scryfall bulk type "${type}" not found. Available: ${available}`);
  }
  return match;
};

/**
 * Fetch all Scryfall sets (follows next_page). Used for block / parent_set_code metadata.
 */
export const fetchAllScryfallSets = async (logger: Logger): Promise<ScryfallSet[]> => {
  const sets: ScryfallSet[] = [];
  let url: string | null = SETS_URL;

  while (url) {
    logger.info({ event: 'scryfall.sets.fetch', url }, 'Fetching Scryfall sets page');
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    if (!response.ok) {
      throw new Error(`Scryfall sets HTTP ${response.status}: ${await response.text()}`);
    }
    const json: unknown = await response.json();
    const parsed = scryfallSetListSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Unexpected Scryfall sets document: ${parsed.error.message}`);
    }
    sets.push(...parsed.data.data);
    url = parsed.data.has_more && parsed.data.next_page ? parsed.data.next_page : null;
    if (url) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }

  logger.info({ event: 'scryfall.sets.ok', count: sets.length }, 'Fetched Scryfall sets');
  return sets;
};

export const openBulkDownload = async (
  item: BulkDataItem,
  logger: Logger,
  signal?: AbortSignal,
): Promise<{
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  uri: string;
}> => {
  const uri = bulkDownloadUri(item);
  logger.info(
    {
      event: 'scryfall.bulk_download.start',
      type: item.type,
      url: uri,
      size: bulkByteSize(item),
      updatedAt: item.updated_at,
    },
    'Downloading Scryfall bulk dataset',
  );

  const response = await fetch(uri, {
    headers: {
      Accept: '*/*',
      'User-Agent': DEFAULT_HEADERS['User-Agent'],
    },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Scryfall bulk download HTTP ${response.status}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : bulkByteSize(item);

  return { body: response.body, contentLength, uri };
};
