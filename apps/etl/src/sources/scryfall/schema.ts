import { z } from 'zod';

const optionalText = z.string().optional().nullable();
const optionalStringList = z.array(z.string()).optional();
const optionalId = z.union([z.number(), z.string()]).optional();
const imageUrisSchema = z.record(z.string(), z.string()).optional().nullable();

const scryfallFaceSchema = z
  .object({
    oracle_id: z.uuid().optional().nullable(),
    name: z.string().optional().nullable(),
    mana_cost: optionalText,
    type_line: z.string().optional(),
    oracle_text: optionalText,
    colors: optionalStringList,
    power: optionalText,
    toughness: optionalText,
    loyalty: optionalText,
    defense: optionalText,
    image_uris: imageUrisSchema,
  })
  .passthrough();

/** Identity fields required for catalog; extras stay optional via passthrough. */
export const scryfallCardSchema = z
  .object({
    id: z.uuid(),
    oracle_id: z.uuid().optional().nullable(),
    name: z.string().min(1),
    set: z.string().min(1),
    set_name: z.string().min(1),
    collector_number: z.string().min(1),
    lang: z.string().optional(),
    released_at: optionalText,
    uri: z.string().optional(),
    scryfall_uri: z.string().optional(),
    layout: z.string().optional(),
    type_line: z.string().optional(),
    digital: z.boolean().optional(),
    rarity: z.string().optional(),
    updated_at: z.union([z.string(), z.number()]).optional().nullable(),
    set_id: z.uuid().optional().nullable(),
    set_type: z.string().optional(),
    mana_cost: optionalText,
    cmc: z.union([z.number(), z.string()]).optional().nullable(),
    oracle_text: optionalText,
    colors: optionalStringList,
    color_identity: optionalStringList,
    keywords: optionalStringList,
    reserved: z.boolean().optional(),
    artist: optionalText,
    border_color: z.string().optional(),
    frame: z.string().optional(),
    full_art: z.boolean().optional(),
    textless: z.boolean().optional(),
    oversized: z.boolean().optional(),
    promo: z.boolean().optional(),
    reprint: z.boolean().optional(),
    finishes: optionalStringList,
    legalities: z.record(z.string(), z.string()),
    image_uris: imageUrisSchema,
    card_faces: z.array(scryfallFaceSchema).optional(),
    tcgplayer_id: optionalId,
    tcgplayer_etched_id: optionalId,
    cardmarket_id: optionalId,
    mtgo_id: optionalId,
    power: optionalText,
    toughness: optionalText,
    loyalty: optionalText,
    defense: optionalText,
  })
  .passthrough();

export type ScryfallCard = z.infer<typeof scryfallCardSchema>;

export const bulkDataItemSchema = z.object({
  object: z.literal('bulk_data'),
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
  object: z.literal('list'),
  data: z.array(bulkDataItemSchema),
});

export type BulkDataItem = z.infer<typeof bulkDataItemSchema>;

export const bulkDownloadUri = (item: BulkDataItem): string => {
  const uri = item.jsonl_download_uri ?? item.download_uri;
  if (!uri) {
    throw new Error(`Scryfall bulk item "${item.type}" has no download URI`);
  }
  return uri;
};

export const bulkByteSize = (item: BulkDataItem): number | null =>
  item.compressed_size ?? item.size ?? null;
