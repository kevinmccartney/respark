import type { Logger } from '../../core/logger';

import { ALL_IDENTIFIERS_URL, META_URL, mtgjsonMetaSchema } from './schema';

const DEFAULT_HEADERS = {
  Accept: '*/*',
  'User-Agent': 'respark-etl/0.1 (MTG catalog pipeline)',
} as const;

export type MtgjsonDataset = {
  version: string;
  date: string;
  downloadUrl: string;
  compressedBytes: number | null;
};

export const fetchMtgjsonMeta = async (logger: Logger): Promise<MtgjsonDataset> => {
  logger.info({ event: 'mtgjson.meta.fetch', url: META_URL }, 'Fetching MTGJSON meta');
  const response = await fetch(META_URL, {
    headers: { Accept: 'application/json', 'User-Agent': DEFAULT_HEADERS['User-Agent'] },
  });
  if (!response.ok) {
    throw new Error(`MTGJSON Meta HTTP ${response.status}: ${await response.text()}`);
  }

  const parsed = mtgjsonMetaSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`Unexpected MTGJSON Meta document: ${parsed.error.message}`);
  }

  const { date, version } = parsed.data.meta;
  logger.info({ event: 'mtgjson.meta.ok', date, version }, 'Fetched MTGJSON meta');

  return {
    version,
    date,
    downloadUrl: ALL_IDENTIFIERS_URL,
    compressedBytes: null,
  };
};

export const openAllIdentifiersDownload = async (
  dataset: MtgjsonDataset,
  logger: Logger,
  signal?: AbortSignal,
): Promise<{
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  uri: string;
}> => {
  const uri = dataset.downloadUrl;
  logger.info(
    {
      event: 'mtgjson.download.start',
      url: uri,
      version: dataset.version,
      date: dataset.date,
    },
    'Downloading MTGJSON AllIdentifiers',
  );

  const response = await fetch(uri, {
    headers: DEFAULT_HEADERS,
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`MTGJSON AllIdentifiers HTTP ${response.status}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;

  return { body: response.body, contentLength, uri };
};
