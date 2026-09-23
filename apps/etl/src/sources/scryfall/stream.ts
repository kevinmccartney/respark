import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';

export type JsonlLine = { ok: true; value: unknown } | { ok: false; error: string; line: string };

/**
 * Stream each JSON object from a gzipped JSONL body (Scryfall's current bulk format).
 * A bad line is yielded as a failure so the catalog job can record it and continue.
 */
export async function* streamJsonlGzip(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<JsonlLine> {
  const nodeReadable = Readable.fromWeb(body as unknown as NodeReadableStream);
  const lines = createInterface({ input: nodeReadable.pipe(createGunzip()), crlfDelay: Infinity });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      yield { ok: true, value: JSON.parse(trimmed) as unknown };
    } catch (err) {
      yield {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        line: trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed,
      };
    }
  }
}
