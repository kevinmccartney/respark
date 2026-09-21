import {
  LOOKUP_COMBOS_ALMOST_CAP,
  LOOKUP_COMBOS_DESCRIPTION_MAX,
  LOOKUP_COMBOS_INCLUDED_CAP,
  LOOKUP_COMBOS_QUERY_CAP,
  lookupCombosInputSchema,
  type LookupCombosInput,
  type LookupCombosResult,
} from 'schemas/chat';
import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';
import { SPELLBOOK_COMBO_URL, SPELLBOOK_SITE_URL } from '../spellbook/constants';
import { toSpellbookDecklist } from '../spellbook/decklist';
import {
  SpellbookUpstreamError,
  type SpellbookCardUse,
  type SpellbookClient,
  type SpellbookVariantSlice,
} from '../spellbook/types';
import type { ChatTool } from './types';

type CatalogResolve = {
  byOracle: Map<string, { id: string; name: string }>;
  byName: Map<string, string>;
};

const source = { name: 'Commander Spellbook' as const, url: SPELLBOOK_SITE_URL };

const truncateDescription = (text: string | null): string | null => {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length <= LOOKUP_COMBOS_DESCRIPTION_MAX) return trimmed;
  return `${trimmed.slice(0, LOOKUP_COMBOS_DESCRIPTION_MAX - 1).trimEnd()}…`;
};

const catalogIdFor = (use: SpellbookCardUse, catalog: CatalogResolve): string | null => {
  if (use.oracleId) {
    const hit = catalog.byOracle.get(use.oracleId.toLowerCase());
    if (hit) return hit.id;
  }
  return catalog.byName.get(use.name.toLowerCase()) ?? null;
};

const compactUse = (use: SpellbookCardUse, inDeckNames: Set<string>, catalog: CatalogResolve) => ({
  name: use.name,
  catalogId: catalogIdFor(use, catalog),
  inDeck: inDeckNames.has(use.name.toLowerCase()),
});

const compactCombo = (
  variant: SpellbookVariantSlice,
  inDeckNames: Set<string>,
  catalog: CatalogResolve,
  includeMissing: boolean,
) => {
  const uses = variant.uses.map((use) => compactUse(use, inDeckNames, catalog));
  return {
    id: variant.id,
    produces: variant.produces,
    uses,
    missing: includeMissing ? uses.filter((use) => !use.inDeck) : [],
    manaNeeded: variant.manaNeeded,
    description: truncateDescription(variant.description),
    popularity: variant.popularity,
    bracketTag: variant.bracketTag,
    url: `${SPELLBOOK_COMBO_URL}/${encodeURIComponent(variant.id)}`,
  };
};

const resolveCatalog = async (
  cards: CardsService,
  variants: SpellbookVariantSlice[],
): Promise<CatalogResolve> => {
  const oracleIds: string[] = [];
  for (const variant of variants) {
    for (const use of variant.uses) {
      if (use.oracleId) oracleIds.push(use.oracleId);
    }
  }
  const byOracle = await cards.findByOracleIds(oracleIds);
  const unresolved = new Set<string>();
  for (const variant of variants) {
    for (const use of variant.uses) {
      if (use.oracleId && byOracle.has(use.oracleId.toLowerCase())) continue;
      unresolved.add(use.name);
    }
  }
  const byName = await cards.findIdsByExactNames([...unresolved]);
  return { byOracle, byName };
};

export const lookupCombosTool = (
  decks: DecksService,
  cards: CardsService,
  spellbook: SpellbookClient,
): ChatTool<LookupCombosInput, LookupCombosResult> => ({
  name: 'lookupCombos',
  description:
    'Look up Commander Spellbook combos. Call when the player asks about combos, infinites, wincons, missing pieces for a combo, or whether a line is a 2-card combo — or when getDeck description / commander oracle / keywordCounts look combo-shaped. Do not call for a generic good-add, interaction, or ramp ask. Pass q (e.g. card:"Name") to search variants; otherwise uses the sticky or explicit deck. Credit commanderspellbook.com.',
  inputSchema: lookupCombosInputSchema,
  execute: async (input, ctx) => {
    const q = input.q?.trim() ?? '';
    const deckId = input.deckId ?? ctx.deckId;
    if (!q && !deckId) {
      return {
        ok: false,
        code: 'validation',
        message: 'Need a deck or a combo search query.',
      };
    }

    try {
      if (q) {
        let inDeckNames = new Set<string>();
        if (deckId) {
          const detail = await decks.getForUser(ctx.clerkUserId, deckId);
          ctx.deckId = detail.deck.id;
          inDeckNames = new Set(
            detail.cards.filter((card) => !card.sideboard).map((card) => card.name.toLowerCase()),
          );
        }
        const variants = (await spellbook.searchVariants(q, LOOKUP_COMBOS_QUERY_CAP)).slice(
          0,
          LOOKUP_COMBOS_QUERY_CAP,
        );
        const catalog = await resolveCatalog(cards, variants);
        return {
          ok: true,
          data: {
            mode: 'query',
            variants: variants.map((variant) => compactCombo(variant, inDeckNames, catalog, false)),
            source,
          },
        };
      }

      const detail = await decks.getForUser(ctx.clerkUserId, deckId as string);
      ctx.deckId = detail.deck.id;
      const inDeckNames = new Set(
        detail.cards.filter((card) => !card.sideboard).map((card) => card.name.toLowerCase()),
      );
      const found = await spellbook.findMyCombos(toSpellbookDecklist(detail));
      const included = found.included.slice(0, LOOKUP_COMBOS_INCLUDED_CAP);
      const almostIncluded = found.almostIncluded.slice(0, LOOKUP_COMBOS_ALMOST_CAP);
      const catalog = await resolveCatalog(cards, [...included, ...almostIncluded]);
      return {
        ok: true,
        data: {
          mode: 'deck',
          included: included.map((variant) => compactCombo(variant, inDeckNames, catalog, false)),
          almostIncluded: almostIncluded.map((variant) =>
            compactCombo(variant, inDeckNames, catalog, true),
          ),
          source,
        },
      };
    } catch (err) {
      if (err instanceof SpellbookUpstreamError) {
        return { ok: false, code: 'upstream', message: err.message };
      }
      throw err;
    }
  },
});
