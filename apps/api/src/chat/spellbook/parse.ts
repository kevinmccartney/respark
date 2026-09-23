import { z } from 'zod';

import type { SpellbookCardUse, SpellbookVariantSlice } from './types';

const spellbookCardSchema = z.looseObject({
  name: z.string(),
  oracleId: z.string().nullable().optional(),
});

const spellbookUseSchema = z.union([
  z.looseObject({ card: spellbookCardSchema }),
  spellbookCardSchema,
]);

const spellbookFeatureSchema = z.union([
  z.looseObject({ feature: z.looseObject({ name: z.string() }) }),
  z.looseObject({ name: z.string() }),
  z.string(),
]);

export const spellbookVariantSchema = z.looseObject({
  id: z.union([z.string(), z.number()]),
  uses: z.array(spellbookUseSchema).optional(),
  produces: z.array(spellbookFeatureSchema).optional(),
  manaNeeded: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  popularity: z.number().nullable().optional(),
  bracketTag: z.string().nullable().optional(),
});

export const findMyCombosResponseSchema = z.looseObject({
  results: z
    .looseObject({
      included: z.array(spellbookVariantSchema).optional(),
      almostIncluded: z.array(spellbookVariantSchema).optional(),
      almost_included: z.array(spellbookVariantSchema).optional(),
    })
    .optional(),
  included: z.array(spellbookVariantSchema).optional(),
  almostIncluded: z.array(spellbookVariantSchema).optional(),
  almost_included: z.array(spellbookVariantSchema).optional(),
});

export const variantsListResponseSchema = z.looseObject({
  results: z.array(spellbookVariantSchema).optional(),
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const textField = (row: Record<string, unknown>, key: string): string | null => {
  const value = row[key];
  return typeof value === 'string' ? value : null;
};

const useFromRaw = (raw: z.infer<typeof spellbookUseSchema>): SpellbookCardUse | null => {
  const row = asRecord(raw);
  if (!row) return null;
  const nested = asRecord(row.card);
  const card = nested ?? row;
  const name = textField(card, 'name')?.trim();
  if (!name) return null;
  return { name, oracleId: textField(card, 'oracleId') };
};

const produceFromRaw = (raw: z.infer<typeof spellbookFeatureSchema>): string | null => {
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name.length > 0 ? name : null;
  }
  const row = asRecord(raw);
  if (!row) return null;
  const nested = asRecord(row.feature);
  const name = textField(nested ?? row, 'name')?.trim();
  return name && name.length > 0 ? name : null;
};

export const toVariantSlice = (
  raw: z.infer<typeof spellbookVariantSchema>,
): SpellbookVariantSlice | null => {
  const id = String(raw.id).trim();
  if (!id) return null;
  const uses = (raw.uses ?? [])
    .map(useFromRaw)
    .filter((use): use is SpellbookCardUse => use !== null);
  if (uses.length === 0) return null;
  const produces = (raw.produces ?? [])
    .map(produceFromRaw)
    .filter((name): name is string => name !== null);
  return {
    id,
    uses,
    produces,
    manaNeeded: raw.manaNeeded ?? null,
    description: raw.description ?? null,
    popularity: raw.popularity ?? null,
    bracketTag: raw.bracketTag ?? null,
  };
};

export const slicesFromVariants = (raw: unknown): SpellbookVariantSlice[] => {
  const parsed = variantsListResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  return (parsed.data.results ?? [])
    .map(toVariantSlice)
    .filter((slice): slice is SpellbookVariantSlice => slice !== null);
};

export const slicesFromFindMyCombos = (
  raw: unknown,
): { included: SpellbookVariantSlice[]; almostIncluded: SpellbookVariantSlice[] } => {
  const parsed = findMyCombosResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { included: [], almostIncluded: [] };
  }
  const includedRaw = parsed.data.results?.included ?? parsed.data.included ?? [];
  const almostRaw =
    parsed.data.results?.almostIncluded ??
    parsed.data.results?.almost_included ??
    parsed.data.almostIncluded ??
    parsed.data.almost_included ??
    [];
  return {
    included: includedRaw
      .map(toVariantSlice)
      .filter((slice): slice is SpellbookVariantSlice => slice !== null),
    almostIncluded: almostRaw
      .map(toVariantSlice)
      .filter((slice): slice is SpellbookVariantSlice => slice !== null),
  };
};
