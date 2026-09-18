import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

/**
 * Stream each JSON object from a gzipped JSONL body (Scryfall's current bulk format).
 */
export async function* streamJsonlGzip(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const nodeReadable = Readable.fromWeb(body as unknown as NodeReadableStream)
  const lines = createInterface({ input: nodeReadable.pipe(createGunzip()), crlfDelay: Infinity })

  for await (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    yield JSON.parse(trimmed) as unknown
  }
}
