import { isoDateTimeSchema, uuidSchema } from './primitives.js';
import { z } from 'zod';

export const recommendationDownweightKindSchema = z.enum([
  'staple',
  'tutor',
  'extra_turn',
  'stax',
  'other',
]);

export type RecommendationDownweightKind = z.infer<typeof recommendationDownweightKindSchema>;

export const recommendationDownweightFlagSchema = z.object({
  kind: recommendationDownweightKindSchema,
  note: z.string().nullable(),
});

export type RecommendationDownweightFlag = z.infer<typeof recommendationDownweightFlagSchema>;

export const recommendationDownweightSchema = z.object({
  cardId: uuidSchema,
  name: z.string(),
  kind: recommendationDownweightKindSchema,
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export type RecommendationDownweight = z.infer<typeof recommendationDownweightSchema>;

export const recommendationDownweightsResponseSchema = z.object({
  downweights: z.array(recommendationDownweightSchema),
});

export type RecommendationDownweightsResponse = z.infer<
  typeof recommendationDownweightsResponseSchema
>;

export const recommendationDownweightResponseSchema = z.object({
  downweight: recommendationDownweightSchema,
});

export type RecommendationDownweightResponse = z.infer<
  typeof recommendationDownweightResponseSchema
>;

export const createRecommendationDownweightBodySchema = z
  .object({
    cardId: uuidSchema.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    kind: recommendationDownweightKindSchema,
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .refine((value) => Boolean(value.cardId) !== Boolean(value.name), {
    message: 'Provide exactly one of cardId or name',
  });

export type CreateRecommendationDownweightBody = z.infer<
  typeof createRecommendationDownweightBodySchema
>;

export type RecommendationDownweightSeed = {
  name: string;
  kind: RecommendationDownweightKind;
  note: string;
};

/** Starter policy list. Applied once by migration when those catalog names exist. */
export const RECOMMENDATION_DOWNWEIGHT_SEEDS: readonly RecommendationDownweightSeed[] = [
  { name: 'Rhystic Study', kind: 'staple', note: 'Format-wide extra-mana tax' },
  { name: 'Smothering Tithe', kind: 'staple', note: 'Format-wide extra-mana tax' },
  { name: 'Cyclonic Rift', kind: 'staple', note: 'Generic one-sided board wipe' },
  { name: 'Dockside Extortionist', kind: 'staple', note: 'Generic treasure engine' },
  { name: 'Esper Sentinel', kind: 'staple', note: 'Generic card-advantage staple' },
  { name: 'The One Ring', kind: 'staple', note: 'Generic card-advantage staple' },
  { name: 'Fierce Guardianship', kind: 'staple', note: 'Free-spell cycle staple' },
  { name: 'Deadly Rollick', kind: 'staple', note: 'Free-spell cycle staple' },
  { name: 'Deflecting Swat', kind: 'staple', note: 'Free-spell cycle staple' },
  { name: "Teferi's Protection", kind: 'staple', note: 'Generic fog / protection' },
  { name: 'Demonic Tutor', kind: 'tutor', note: 'Generic black tutor' },
  { name: 'Vampiric Tutor', kind: 'tutor', note: 'Generic black tutor' },
  { name: 'Imperial Seal', kind: 'tutor', note: 'Generic black tutor' },
  { name: 'Mystical Tutor', kind: 'tutor', note: 'Generic blue instant/sorcery tutor' },
  { name: 'Enlightened Tutor', kind: 'tutor', note: 'Generic white enchantment/artifact tutor' },
  { name: 'Worldly Tutor', kind: 'tutor', note: 'Generic green creature tutor' },
  { name: 'Grim Tutor', kind: 'tutor', note: 'Generic black tutor' },
  { name: 'Time Warp', kind: 'extra_turn', note: 'Generic extra turn' },
  { name: 'Nexus of Fate', kind: 'extra_turn', note: 'Generic extra turn' },
  { name: 'Temporal Manipulation', kind: 'extra_turn', note: 'Generic extra turn' },
  { name: 'Drannith Magistrate', kind: 'stax', note: 'Generic commander-tax stax' },
  { name: 'Rule of Law', kind: 'stax', note: 'Generic spell-limit stax' },
  { name: 'Winter Orb', kind: 'stax', note: 'Generic mana stax' },
];
