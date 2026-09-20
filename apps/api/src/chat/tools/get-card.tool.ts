import { getCardInputSchema, type GetCardInput } from 'schemas/chat';
import type { CardDetail } from 'schemas/cards';
import type { CardsService } from '../../cards/cards.service';
import type { ChatTool } from './types';

export type GetCardToolResult = Omit<CardDetail, 'printings'>;

export const getCardTool = (cards: CardsService): ChatTool<GetCardInput, GetCardToolResult> => ({
  name: 'getCard',
  description:
    'Load one catalog card by id (oracle text, legalities, color identity). Do not use this to dump printings.',
  inputSchema: getCardInputSchema,
  execute: async (input, ctx) => {
    const card = await cards.getById(input.cardId);
    ctx.cardId = card.id;
    return {
      ok: true,
      data: {
        id: card.id,
        oracleId: card.oracleId,
        name: card.name,
        manaCost: card.manaCost,
        manaValue: card.manaValue,
        typeLine: card.typeLine,
        oracleText: card.oracleText,
        colors: card.colors,
        colorIdentity: card.colorIdentity,
        keywords: card.keywords,
        legalities: card.legalities,
        leadershipSkills: card.leadershipSkills,
        layout: card.layout,
        reserved: card.reserved,
        edhrecRank: card.edhrecRank,
        edhrecSaltiness: card.edhrecSaltiness,
        isGameChanger: card.isGameChanger,
        downweight: card.downweight,
      },
    };
  },
});
