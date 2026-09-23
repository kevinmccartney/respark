import { z } from 'zod';

import { isoDateTimeSchema, uuidSchema } from './primitives.js';

export const goodstuffTagSchema = z.enum([
  'spot_removal',
  'interaction',
  'efficient',
  'flexible_removal',
  'board_wipe',
  'board_control',
  'cost_reduction',
  'modal',
  'protection',
  'board_protection',
  'instant_speed',
  'counterspell',
  'recursion',
  'reanimation',
  'ramp',
  'burst_mana',
  'mana_dork',
  'fixing',
  'land_ramp',
  'haste',
  'equipment',
  'card_selection',
  'value_engine',
  'card_advantage',
  'land_advantage',
  'land',
  'mana_engine',
  'mana_fixing',
  'utility_land',
  'removal',
  'channel',
  'fast_mana',
  'free_spell',
  'card_draw',
  'tax',
  'graveyard_hate',
  'theft',
  'punisher',
  'stax',
  'hatebear',
  'tutor_hate',
  'interaction_denial',
]);

export type GoodstuffTag = z.infer<typeof goodstuffTagSchema>;

export const recommendationGoodstuffFlagSchema = z.object({
  tags: z.array(goodstuffTagSchema).min(1),
  note: z.string().nullable(),
});

export type RecommendationGoodstuffFlag = z.infer<typeof recommendationGoodstuffFlagSchema>;

export const recommendationGoodstuffSchema = z.object({
  cardId: uuidSchema,
  name: z.string(),
  tags: z.array(goodstuffTagSchema).min(1),
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export type RecommendationGoodstuff = z.infer<typeof recommendationGoodstuffSchema>;

export const recommendationGoodstuffsResponseSchema = z.object({
  goodstuffs: z.array(recommendationGoodstuffSchema),
});

export type RecommendationGoodstuffsResponse = z.infer<
  typeof recommendationGoodstuffsResponseSchema
>;

export const recommendationGoodstuffResponseSchema = z.object({
  goodstuff: recommendationGoodstuffSchema,
});

export type RecommendationGoodstuffResponse = z.infer<typeof recommendationGoodstuffResponseSchema>;

export const createRecommendationGoodstuffBodySchema = z
  .object({
    cardId: uuidSchema.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    tags: z.array(goodstuffTagSchema).min(1),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .refine((value) => Boolean(value.cardId) !== Boolean(value.name), {
    message: 'Provide exactly one of cardId or name',
  });

export type CreateRecommendationGoodstuffBody = z.infer<
  typeof createRecommendationGoodstuffBodySchema
>;

export type RecommendationGoodstuffSeed = {
  name: string;
  tags: readonly GoodstuffTag[];
  note?: string;
};

/** Starter policy list. Applied once by migration when those catalog names exist. */
export const RECOMMENDATION_GOODSTUFF_SEEDS: readonly RecommendationGoodstuffSeed[] = [
  { name: 'Swords to Plowshares', tags: ['spot_removal', 'interaction', 'efficient'] },
  { name: 'Path to Exile', tags: ['spot_removal', 'interaction', 'efficient'] },
  { name: 'Generous Gift', tags: ['spot_removal', 'interaction', 'flexible_removal'] },
  { name: 'Beast Within', tags: ['spot_removal', 'interaction', 'flexible_removal'] },
  { name: "Assassin's Trophy", tags: ['spot_removal', 'interaction', 'flexible_removal'] },
  { name: 'Toxic Deluge', tags: ['board_wipe', 'board_control', 'efficient'] },
  { name: 'Blasphemous Act', tags: ['board_wipe', 'board_control', 'cost_reduction'] },
  {
    name: 'Austere Command',
    tags: ['board_wipe', 'board_control', 'modal', 'flexible_removal'],
  },
  { name: 'Heroic Intervention', tags: ['protection', 'board_protection', 'instant_speed'] },
  { name: 'Counterspell', tags: ['counterspell', 'interaction'] },
  { name: 'Swan Song', tags: ['counterspell', 'interaction', 'efficient'] },
  { name: "An Offer You Can't Refuse", tags: ['counterspell', 'interaction', 'efficient'] },
  { name: 'Reanimate', tags: ['recursion', 'reanimation', 'efficient'] },
  { name: 'Dark Ritual', tags: ['ramp', 'burst_mana'] },
  { name: 'Birds of Paradise', tags: ['ramp', 'mana_dork', 'fixing'] },
  { name: 'Bloom Tender', tags: ['ramp', 'mana_dork', 'fixing'] },
  { name: 'Farseek', tags: ['ramp', 'land_ramp', 'fixing'] },
  { name: "Nature's Lore", tags: ['ramp', 'land_ramp', 'fixing'] },
  { name: 'Three Visits', tags: ['ramp', 'land_ramp', 'fixing'] },
  { name: 'Lightning Greaves', tags: ['protection', 'haste', 'equipment'] },
  { name: 'Swiftfoot Boots', tags: ['protection', 'haste', 'equipment'] },
  { name: "Sensei's Divining Top", tags: ['card_selection', 'value_engine'] },
  { name: 'Land Tax', tags: ['card_advantage', 'land_advantage', 'value_engine'] },
  { name: 'Cabal Coffers', tags: ['ramp', 'land', 'mana_engine'] },
  { name: 'Urborg, Tomb of Yawgmoth', tags: ['mana_fixing', 'land', 'utility_land'] },
  { name: 'Boseiju, Who Endures', tags: ['removal', 'interaction', 'utility_land', 'channel'] },
  { name: 'Ancient Tomb', tags: ['ramp', 'utility_land', 'fast_mana'] },
  { name: 'Mana Drain', tags: ['counterspell', 'interaction', 'ramp'] },
  { name: 'Force of Will', tags: ['counterspell', 'interaction', 'free_spell'] },
  { name: 'Force of Negation', tags: ['counterspell', 'interaction', 'free_spell'] },
  { name: 'Mana Vault', tags: ['ramp', 'fast_mana'] },
  { name: 'Chrome Mox', tags: ['ramp', 'fast_mana'] },
  { name: 'Mox Diamond', tags: ['ramp', 'fast_mana'] },
  { name: "Jeska's Will", tags: ['ramp', 'burst_mana', 'card_advantage'] },
  { name: 'Necropotence', tags: ['card_draw', 'value_engine'] },
  { name: 'Mystic Remora', tags: ['card_draw', 'value_engine', 'tax'] },
  { name: 'Sylvan Library', tags: ['card_selection', 'card_draw', 'value_engine'] },
  { name: 'Dauthi Voidwalker', tags: ['graveyard_hate', 'value_engine', 'theft'] },
  { name: 'Orcish Bowmasters', tags: ['interaction', 'punisher', 'value_engine'] },
  { name: 'Opposition Agent', tags: ['stax', 'hatebear', 'tutor_hate', 'theft'] },
  { name: 'Grand Abolisher', tags: ['protection', 'stax', 'interaction_denial'] },
];
