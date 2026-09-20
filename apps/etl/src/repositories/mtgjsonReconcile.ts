import type { PoolClient } from 'pg';
import type { LeadershipSkills } from 'schemas/cards';
import type { EnrichmentIdentifier, MtgjsonEnrichment } from '../sources/mtgjson/transformer';

export type MatchStatus = 'matched' | 'unmatched' | 'ambiguous';

export type MatchResult = {
  status: MatchStatus;
  printingId: string | null;
  identifiersAdded: number;
  reason: string;
};

export type UnmatchedRecord = {
  mtgjsonUuid: string;
  name: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  language: string | null;
  scryfallId: string | null;
  reason: string;
};

/**
 * Resolve an MTGJSON card to an existing catalog.printing.
 * Never creates printings — Scryfall owns canonical identity.
 *
 * Match order:
 * 1. identifiers.scryfallId → catalog.printing.scryfall_id
 * 2. set code + collector number (+ language when available)
 */
export const resolvePrinting = async (
  client: PoolClient,
  enrichment: MtgjsonEnrichment,
): Promise<{ status: MatchStatus; printingId: string | null; reason: string }> => {
  if (enrichment.scryfallId) {
    // Guard against non-UUID scryfall ids from older MTGJSON rows
    const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      enrichment.scryfallId,
    );
    if (looksUuid) {
      const byScryfall = await client.query<{ id: string }>(
        `select id from catalog.printing where scryfall_id = $1::uuid`,
        [enrichment.scryfallId],
      );
      if (byScryfall.rows.length === 1) {
        return { status: 'matched', printingId: byScryfall.rows[0].id, reason: 'scryfall_id' };
      }
      if (byScryfall.rows.length > 1) {
        return {
          status: 'ambiguous',
          printingId: null,
          reason: `multiple printings for scryfall_id=${enrichment.scryfallId}`,
        };
      }
    }
  }

  if (enrichment.setCode && enrichment.collectorNumber) {
    const params: unknown[] = [enrichment.setCode.toLowerCase(), enrichment.collectorNumber];
    let langClause = '';
    if (enrichment.language) {
      // MTGJSON uses "English"; Scryfall uses "en"
      const lang =
        enrichment.language.toLowerCase() === 'english'
          ? 'en'
          : enrichment.language.toLowerCase().slice(0, 2);
      params.push(lang);
      langClause = ` and p.language = $${params.length}`;
    }

    const bySetNumber = await client.query<{ id: string }>(
      `select p.id
       from catalog.printing p
       join catalog.set s on s.id = p.set_id
       where lower(s.code) = $1
         and p.collector_number = $2
         ${langClause}`,
      params,
    );

    if (bySetNumber.rows.length === 1) {
      return {
        status: 'matched',
        printingId: bySetNumber.rows[0].id,
        reason: enrichment.scryfallId ? 'set_number_fallback' : 'set_number',
      };
    }
    if (bySetNumber.rows.length > 1) {
      return {
        status: 'ambiguous',
        printingId: null,
        reason: `multiple printings for ${enrichment.setCode}#${enrichment.collectorNumber}`,
      };
    }
  }

  return {
    status: 'unmatched',
    printingId: null,
    reason: enrichment.scryfallId
      ? 'scryfall_id_not_in_catalog'
      : 'no_scryfall_id_and_no_set_number_match',
  };
};

/**
 * Attach MTGJSON-derived provider IDs to a matched printing.
 * Returns how many identifiers were newly written or re-pointed.
 */
export const enrichPrintingIdentifiers = async (
  client: PoolClient,
  printingId: string,
  identifiers: EnrichmentIdentifier[],
): Promise<number> => {
  let added = 0;
  for (const id of identifiers) {
    if (id.provider === 'scryfall') continue;

    const result = await client.query<{ is_insert: boolean }>(
      `insert into catalog.printing_identifier as t
         (printing_id, provider, external_id, updated_at)
       values ($1, $2, $3, now())
       on conflict (provider, external_id) do update set
         printing_id = excluded.printing_id,
         updated_at = now()
       where t.printing_id is distinct from excluded.printing_id
       returning (xmax::text = '0') as is_insert`,
      [printingId, id.provider, id.externalId],
    );
    if (result.rows.length > 0) added += 1;
  }
  return added;
};

/**
 * Copy MTGJSON leadershipSkills onto the matched oracle card.
 * A later printing does not clear `commander: true` already stored.
 */
export const applyCardLeadershipSkills = async (
  client: PoolClient,
  printingId: string,
  leadershipSkills: LeadershipSkills | null,
): Promise<void> => {
  if (!leadershipSkills) return;
  await client.query(
    `update catalog.card c
     set leadership_skills = $2::jsonb, updated_at = now()
     from catalog.printing p
     where p.id = $1
       and p.card_id = c.id
       and (
         c.leadership_skills is null
         or (c.leadership_skills->>'commander') is distinct from 'true'
         or $2::jsonb->>'commander' = 'true'
       )
       and c.leadership_skills is distinct from $2::jsonb`,
    [printingId, JSON.stringify(leadershipSkills)],
  );
};

/**
 * Copy MTGJSON salt onto the matched oracle card. Fills `is_game_changer`
 * only when Scryfall left it null.
 */
export const applyCardEdhrecStats = async (
  client: PoolClient,
  printingId: string,
  opts: { edhrecSaltiness: number | null; isGameChanger: boolean | null },
): Promise<void> => {
  if (opts.edhrecSaltiness === null && opts.isGameChanger === null) return;
  await client.query(
    `update catalog.card c
     set
       edhrec_saltiness = coalesce($2::numeric, c.edhrec_saltiness),
       is_game_changer = coalesce(c.is_game_changer, $3),
       updated_at = now()
     from catalog.printing p
     where p.id = $1
       and p.card_id = c.id
       and (
         c.edhrec_saltiness is distinct from coalesce($2::numeric, c.edhrec_saltiness)
         or c.is_game_changer is distinct from coalesce(c.is_game_changer, $3)
       )`,
    [printingId, opts.edhrecSaltiness, opts.isGameChanger],
  );
};

export const reconcileMtgjsonCard = async (
  client: PoolClient,
  enrichment: MtgjsonEnrichment,
): Promise<MatchResult> => {
  const match = await resolvePrinting(client, enrichment);
  if (match.status !== 'matched' || !match.printingId) {
    return {
      status: match.status,
      printingId: null,
      identifiersAdded: 0,
      reason: match.reason,
    };
  }

  const identifiersAdded = await enrichPrintingIdentifiers(
    client,
    match.printingId,
    enrichment.identifiers,
  );
  await applyCardLeadershipSkills(client, match.printingId, enrichment.leadershipSkills);
  await applyCardEdhrecStats(client, match.printingId, {
    edhrecSaltiness: enrichment.edhrecSaltiness,
    isGameChanger: enrichment.isGameChanger,
  });

  return {
    status: 'matched',
    printingId: match.printingId,
    identifiersAdded,
    reason: match.reason,
  };
};
