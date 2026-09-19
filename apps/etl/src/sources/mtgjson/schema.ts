import { z } from 'zod';

/** Subset of MTGJSON Card (Set) fields needed for raw storage + reconciliation. */
export const mtgjsonIdentifiersSchema = z
  .object({
    scryfallId: z.string().optional(),
    scryfallOracleId: z.string().optional(),
    tcgplayerProductId: z.string().optional(),
    tcgplayerEtchedProductId: z.string().optional(),
    mcmId: z.string().optional(),
    mtgoId: z.string().optional(),
    multiverseId: z.string().optional(),
  })
  .passthrough();

export const mtgjsonCardSchema = z
  .object({
    uuid: z.string().min(1),
    name: z.string().optional(),
    setCode: z.string().optional(),
    number: z.string().optional(),
    language: z.string().optional(),
    identifiers: mtgjsonIdentifiersSchema.optional(),
  })
  .passthrough();

export type MtgjsonCard = z.infer<typeof mtgjsonCardSchema>;

export const mtgjsonMetaSchema = z.object({
  meta: z.object({
    date: z.string(),
    version: z.string(),
  }),
});

export type MtgjsonMeta = z.infer<typeof mtgjsonMetaSchema>;

export const ALL_IDENTIFIERS_URL = 'https://mtgjson.com/api/v5/AllIdentifiers.json.gz';

export const META_URL = 'https://mtgjson.com/api/v5/Meta.json';
