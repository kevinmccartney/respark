import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';

import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamObject } from 'stream-json/streamers/StreamObject';

/**
 * Stream each card object from gzipped AllIdentifiers.json (`data` map keyed by uuid).
 */
export async function* streamAllIdentifiers(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ key: string; value: unknown }> {
  const nodeReadable = Readable.fromWeb(body as unknown as NodeReadableStream);
  const pipeline = chain([
    nodeReadable,
    createGunzip(),
    parser(),
    pick({ filter: 'data' }),
    streamObject(),
  ]);

  for await (const item of pipeline as AsyncIterable<{ key: string; value: unknown }>) {
    if (item && typeof item.key === 'string') {
      yield item;
    }
  }
}
