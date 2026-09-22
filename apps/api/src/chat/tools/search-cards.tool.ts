import {
  EXCLUDE_CARD_IDS_MAX,
  SEARCH_CARDS_TOOL_DEFAULT_LIMIT,
  SEARCH_CARDS_TOOL_DEFAULT_SORT,
  SEARCH_CARDS_TOOL_MAX_LIMIT,
  searchCardsInputSchema,
  type SearchCardsInput,
} from '@respark/schemas/chat';

import type { CardsService } from '../../cards/cards.service';
import type { DecksService } from '../../decks/decks.service';

import type { ChatTool } from './types';

export type SearchCardsToolResult = {
  cards: Array<{
    id: string;
    name: string;
    manaCost: string | null;
    manaValue: string | null;
    typeLine: string | null;
    oracleText: string | null;
    keywords: string[] | null;
    colorIdentity: string[] | null;
    edhrecRank: number | null;
    edhrecSaltiness: number | null;
    isGameChanger: boolean | null;
    goodstuff: { tags: string[]; note: string | null } | null;
  }>;
  total: number;
};

export const searchCardsTool = (
  decks: DecksService,
  cards: CardsService,
): ChatTool<SearchCardsInput, SearchCardsToolResult> => ({
  name: 'searchCards',
  description:
    'Search the catalog. Prefer scryfall (local Scryfall syntax: t:, id:, o:, mv:, f:, r:, e:, …). When a sticky deck is attached, the server still injects format legality, commander identity (commander format), and in-deck excludes — do not pass f: for the deck format. Without a deck, prefer f:commander (or pass legalIn) and id: for colors. After getDeck, build a scryfall query from commander oracle / types / keywordCounts (e.g. t:creature kw:flying); do not search with an empty query when the list has a theme. sort defaults to edhrecRank; pass name for A-Z. Unsupported Scryfall keywords fail the tool.',
  inputSchema: searchCardsInputSchema,
  execute: async (input, ctx) => {
    const limit = Math.min(
      input.limit ?? SEARCH_CARDS_TOOL_DEFAULT_LIMIT,
      SEARCH_CARDS_TOOL_MAX_LIMIT,
    );
    let legalIn = input.legalIn;
    let colorIdentity = input.colorIdentity;
    let excludeCardIds = [...new Set(input.excludeCardIds ?? [])].slice(0, EXCLUDE_CARD_IDS_MAX);

    if (ctx.deckId) {
      const detail = await decks.getForUser(ctx.clerkUserId, ctx.deckId);
      const inDeck = [...new Set(detail.cards.map((card) => card.cardId))];
      excludeCardIds = [...new Set([...inDeck, ...excludeCardIds])].slice(0, EXCLUDE_CARD_IDS_MAX);
      legalIn = detail.deck.format;
      if (detail.deck.format === 'commander') {
        colorIdentity = detail.deck.colorIdentity;
      }
    }

    const page = await cards.search({
      q: input.q,
      scryfall: input.scryfall,
      typeContains: input.typeContains,
      maxManaValue: input.maxManaValue,
      legalIn,
      colorIdentity,
      excludeCardIds,
      sort: input.sort ?? SEARCH_CARDS_TOOL_DEFAULT_SORT,
      limit,
      page: 1,
    });
    return {
      ok: true,
      data: {
        total: page.total,
        cards: page.cards.map((card) => ({
          id: card.id,
          name: card.name,
          manaCost: card.manaCost,
          manaValue: card.manaValue,
          typeLine: card.typeLine,
          oracleText: card.oracleText,
          keywords: card.keywords,
          colorIdentity: card.colorIdentity,
          edhrecRank: card.edhrecRank,
          edhrecSaltiness: card.edhrecSaltiness,
          isGameChanger: card.isGameChanger,
          goodstuff: card.goodstuff,
        })),
      },
    };
  },
});
