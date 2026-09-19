import type { Logger } from '../../core/logger';
import { bulkByteSize, bulkDataListSchema, bulkDownloadUri, type BulkDataItem } from './schema';

const BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';

/** Scryfall asks for a descriptive User-Agent on automated requests. */
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'respark-etl/0.1 (MTG catalog pipeline)',
} as const;

/** Prefer default_cards: one object per unique English-ish printing. */
export const PREFERRED_BULK_TYPE = 'default_cards';

export async function fetchBulkMetadata(logger: Logger): Promise<BulkDataItem[]> {
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
}

export function selectBulkDataset(
  items: BulkDataItem[],
  type: string = PREFERRED_BULK_TYPE,
): BulkDataItem {
  const match = items.find((item) => item.type === type);
  if (!match) {
    const available = items.map((i) => i.type).join(', ');
    throw new Error(`Scryfall bulk type "${type}" not found. Available: ${available}`);
  }
  return match;
}

export async function openBulkDownload(
  item: BulkDataItem,
  logger: Logger,
  signal?: AbortSignal,
): Promise<{
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  uri: string;
}> {
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
}
