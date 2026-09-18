import { z } from "zod";

/** Minimum fields required to stage a Scryfall printing into raw storage. */
export const scryfallCardSchema = z
  .object({
    id: z.uuid(),
    oracle_id: z.uuid().optional().nullable(),
    name: z.string().min(1),
    lang: z.string().optional(),
    released_at: z.string().optional().nullable(),
    uri: z.string().optional(),
    scryfall_uri: z.string().optional(),
    layout: z.string().optional(),
    set: z.string().optional(),
    set_name: z.string().optional(),
    collector_number: z.string().optional(),
    digital: z.boolean().optional(),
    rarity: z.string().optional(),
    updated_at: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough();

export type ScryfallCard = z.infer<typeof scryfallCardSchema>;

export const bulkDataItemSchema = z.object({
  object: z.literal("bulk_data"),
  id: z.uuid(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  updated_at: z.string(),
  // Scryfall currently ships gzipped JSONL; keep download_uri as a fallback.
  jsonl_download_uri: z.url().optional(),
  download_uri: z.url().optional(),
  compressed_size: z.number().optional(),
  size: z.number().optional(),
  content_type: z.string().optional(),
  content_encoding: z.string().optional(),
});

export const bulkDataListSchema = z.object({
  object: z.literal("list"),
  data: z.array(bulkDataItemSchema),
});

export type BulkDataItem = z.infer<typeof bulkDataItemSchema>;

export function bulkDownloadUri(item: BulkDataItem): string {
  const uri = item.jsonl_download_uri ?? item.download_uri;
  if (!uri) {
    throw new Error(`Scryfall bulk item "${item.type}" has no download URI`);
  }
  return uri;
}

export function bulkByteSize(item: BulkDataItem): number | null {
  return item.compressed_size ?? item.size ?? null;
}
