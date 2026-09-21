import { z } from 'zod';

const optionalText = z.string().optional().nullable();
const optionalStringList = z.array(z.string()).optional();
const optionalId = z.union([z.number(), z.string()]).optional();
const imageUrisSchema = z.record(z.string(), z.string()).optional().nullable();

const scryfallFaceSchema = z.looseObject({
  oracle_id: z.uuid().optional().nullable(),
  name: z.string().optional().nullable(),
  mana_cost: optionalText,
  type_line: z.string().optional(),
  oracle_text: optionalText,
  colors: optionalStringList,
  color_indicator: optionalStringList,
  power: optionalText,
  toughness: optionalText,
  loyalty: optionalText,
  defense: optionalText,
  image_uris: imageUrisSchema,
});

/** Identity fields required for catalog; extras stay optional via z.looseObject. */
export const scryfallCardSchema = z.looseObject({
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
  produced_mana: optionalStringList,
  /** Scryfall color pip list when the card has a color indicator (not a boolean). */
  color_indicator: optionalStringList,
  reserved: z.boolean().optional(),
  artist: optionalText,
  border_color: z.string().optional(),
  frame: z.string().optional(),
  full_art: z.boolean().optional(),
  textless: z.boolean().optional(),
  oversized: z.boolean().optional(),
  promo: z.boolean().optional(),
  reprint: z.boolean().optional(),
  booster: z.boolean().optional().nullable(),
  promo_types: optionalStringList,
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
  edhrec_rank: z.number().int().optional().nullable(),
  game_changer: z.boolean().optional().nullable(),
});

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

/** One row from GET https://api.scryfall.com/sets (paginated list). */
export const scryfallSetSchema = z.looseObject({
  id: z.uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  set_type: z.string().optional().nullable(),
  released_at: optionalText,
  card_count: z.number().int().optional().nullable(),
  digital: z.boolean().optional().nullable(),
  block: optionalText,
  block_code: optionalText,
  parent_set_code: optionalText,
  icon_svg_uri: optionalText,
});

export type ScryfallSet = z.infer<typeof scryfallSetSchema>;

export const scryfallSetListSchema = z.object({
  object: z.literal('list'),
  has_more: z.boolean().optional(),
  next_page: z.string().nullable().optional(),
  data: z.array(scryfallSetSchema),
});

export type ScryfallSetList = z.infer<typeof scryfallSetListSchema>;

export const bulkDownloadUri = (item: BulkDataItem): string => {
  const uri = item.jsonl_download_uri ?? item.download_uri;
  if (!uri) {
    throw new Error(`Scryfall bulk item "${item.type}" has no download URI`);
  }
  return uri;
};

export const bulkByteSize = (item: BulkDataItem): number | null =>
  item.compressed_size ?? item.size ?? null;
