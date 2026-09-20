import { isoDateTimeSchema, uuidSchema } from './primitives.js';
import { z } from 'zod';

export const DECK_FORMATS = ['standard', 'commander', 'modern'] as const;

export const deckFormatSchema = z.enum(DECK_FORMATS);

export type DeckFormat = z.infer<typeof deckFormatSchema>;

export const COLOR_IDENTITY_PIPS = ['W', 'U', 'B', 'R', 'G'] as const;

export const colorIdentityPipSchema = z.enum(COLOR_IDENTITY_PIPS);

export type ColorIdentityPip = z.infer<typeof colorIdentityPipSchema>;

export const colorIdentitySchema = z.array(colorIdentityPipSchema);

const deckNameSchema = z.string().trim().min(1).max(120);

export const deckSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  format: deckFormatSchema,
  colorIdentity: colorIdentitySchema,
  updatedAt: isoDateTimeSchema,
});

export type Deck = z.infer<typeof deckSchema>;

export const deckCardSchema = z.object({
  id: uuidSchema,
  cardId: uuidSchema,
  printingId: uuidSchema,
  name: z.string(),
  manaCost: z.string().nullable(),
  manaValue: z.string().nullable(),
  typeLine: z.string().nullable(),
  oracleText: z.string().nullable(),
  colorIdentity: colorIdentitySchema,
  foil: z.boolean(),
  hasFoil: z.boolean(),
  sideboard: z.boolean(),
  quantity: z.number().int(),
  setCode: z.string(),
  setName: z.string(),
  collectorNumber: z.string(),
  imageNormal: z.string().nullable(),
});

export type DeckCard = z.infer<typeof deckCardSchema>;

export const deckDetailSchema = z.object({
  deck: deckSchema,
  cards: z.array(deckCardSchema),
});

export type DeckDetail = z.infer<typeof deckDetailSchema>;

export const createDeckBodySchema = z
  .object({
    name: deckNameSchema,
    description: z.string().nullable().optional(),
    format: deckFormatSchema.optional().default('standard'),
  })
  .strict();

export type CreateDeckInput = z.infer<typeof createDeckBodySchema>;

export const updateDeckBodySchema = z
  .object({
    name: deckNameSchema.optional(),
    description: z.string().nullable().optional(),
    format: deckFormatSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined || value.format !== undefined,
    { message: 'name, description, or format is required' },
  );

export type UpdateDeckInput = z.infer<typeof updateDeckBodySchema>;

export const importDeckBodySchema = z
  .object({
    text: z.string().trim().min(1),
  })
  .strict();

export type ImportDeckBody = z.infer<typeof importDeckBodySchema>;

export const addDeckCardBodySchema = z
  .object({
    cardId: uuidSchema,
  })
  .strict();

export type AddDeckCardBody = z.infer<typeof addDeckCardBodySchema>;

export const patchDeckCardBodySchema = z
  .object({
    quantity: z.number().int().min(0).optional(),
    printingId: uuidSchema.optional(),
    foil: z.boolean().optional(),
    sideboard: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.quantity !== undefined ||
      value.printingId !== undefined ||
      value.foil !== undefined ||
      value.sideboard !== undefined,
    { message: 'quantity, printingId, foil, or sideboard is required' },
  );

export type PatchDeckCardBody = z.infer<typeof patchDeckCardBodySchema>;

export const decksResponseSchema = z.object({
  decks: z.array(deckSchema),
});

export type DecksResponse = z.infer<typeof decksResponseSchema>;

export const deckResponseSchema = z.object({
  deck: deckSchema,
});

export type DeckResponse = z.infer<typeof deckResponseSchema>;

export const deckCardResponseSchema = z.object({
  card: deckCardSchema.nullable(),
});

export type DeckCardResponse = z.infer<typeof deckCardResponseSchema>;

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

export type OkResponse = z.infer<typeof okResponseSchema>;

export const deckImportUnmatchedSchema = z.object({
  line: z.string(),
  reason: z.string(),
});

export type DeckImportUnmatched = z.infer<typeof deckImportUnmatchedSchema>;

export const deckImportResultSchema = z.object({
  imported: z.number().int(),
  unmatched: z.array(deckImportUnmatchedSchema),
  detail: deckDetailSchema,
});

export type DeckImportResult = z.infer<typeof deckImportResultSchema>;
