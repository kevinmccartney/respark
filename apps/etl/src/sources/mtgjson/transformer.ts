import { leadershipSkillsSchema, type LeadershipSkills } from '@respark/schemas/cards';

import type { MtgjsonCard } from './schema';

export type EnrichmentIdentifier = {
  provider: string;
  externalId: string;
};

export type MtgjsonEnrichment = {
  mtgjsonUuid: string;
  name: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  language: string | null;
  scryfallId: string | null;
  leadershipSkills: LeadershipSkills | null;
  edhrecSaltiness: number | null;
  isGameChanger: boolean | null;
  identifiers: EnrichmentIdentifier[];
};

const toLeadershipSkills = (skills: MtgjsonCard['leadershipSkills']): LeadershipSkills | null => {
  const parsed = leadershipSkillsSchema.safeParse(skills);
  return parsed.success ? parsed.data : null;
};

/**
 * Extract cross-provider IDs and leadershipSkills from an MTGJSON card.
 * Scryfall-owned catalog fields (oracle text, type line, legalities, images) are
 * never written here.
 */
export const extractEnrichment = (card: MtgjsonCard): MtgjsonEnrichment => {
  const ids = card.identifiers ?? {};
  const identifiers: EnrichmentIdentifier[] = [{ provider: 'mtgjson', externalId: card.uuid }];

  const push = (provider: string, value: string | undefined) => {
    if (value && value.length > 0) {
      identifiers.push({ provider, externalId: value });
    }
  };

  push('tcgplayer', ids.tcgplayerProductId ?? ids.tcgplayerEtchedProductId);
  push('cardmarket', ids.mcmId);
  push('mtgo', ids.mtgoId);
  push('multiverse', ids.multiverseId);

  return {
    mtgjsonUuid: card.uuid,
    name: card.name ?? null,
    setCode: card.setCode ?? null,
    collectorNumber: card.number ?? null,
    language: card.language ?? null,
    scryfallId: ids.scryfallId ?? null,
    leadershipSkills: toLeadershipSkills(card.leadershipSkills),
    edhrecSaltiness: asSaltiness(card.edhrecSaltiness),
    isGameChanger: card.isGameChanger ?? null,
    identifiers,
  };
};

const asSaltiness = (value: number | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};
