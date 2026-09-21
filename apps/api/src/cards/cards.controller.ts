import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  CARD_SEARCH_DEFAULT_LIMIT,
  CARD_SEARCH_DEFAULT_SORT,
  CARD_TYPE_SUGGESTIONS_DEFAULT_LIMIT,
  cardSearchQuerySchema,
  cardSuggestionsQuerySchema,
  cardTypeSuggestionsQuerySchema,
  type CardSearchQuery,
  type CardSuggestionsQuery,
  type CardTypeSuggestionsQuery,
} from 'schemas/cards';
import { uuidSchema } from 'schemas/primitives';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { zodPipe } from '../lib/zod-pipe';
import { CardsService } from './cards.service';

@Controller('cards')
@UseGuards(ClerkAuthGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  async search(@Query(zodPipe(cardSearchQuerySchema)) query: CardSearchQuery) {
    return this.cardsService.search({
      q: query.q,
      legalIn: query.legalIn,
      colorIdentity: query.colorIdentity,
      includeColorless: query.includeColorless,
      commanderEligible: query.commanderEligible,
      typeContains: query.typeContains,
      rarity: query.rarity,
      maxManaValue: query.maxManaValue,
      excludeCardIds: query.excludeCardIds,
      sort: query.sort ?? CARD_SEARCH_DEFAULT_SORT,
      dir: query.dir,
      limit: query.limit ?? CARD_SEARCH_DEFAULT_LIMIT,
      page: query.page ?? 1,
    });
  }

  /** Name-only autocomplete for deck building (`id` + `name`). */
  @Get('suggestions')
  async suggestions(@Query(zodPipe(cardSuggestionsQuerySchema)) query: CardSuggestionsQuery) {
    return {
      suggestions: await this.cardsService.suggestNames(query.q, {
        limit: query.limit ?? 15,
        legalIn: query.legalIn,
        colorIdentity: query.colorIdentity,
        commanderEligible: query.commanderEligible,
      }),
    };
  }

  /** Distinct type-line tokens from the catalog for typeContains autocomplete. */
  @Get('type-suggestions')
  async typeSuggestions(
    @Query(zodPipe(cardTypeSuggestionsQuerySchema)) query: CardTypeSuggestionsQuery,
  ) {
    return {
      suggestions: await this.cardsService.suggestTypes(query.q, {
        limit: query.limit ?? CARD_TYPE_SUGGESTIONS_DEFAULT_LIMIT,
      }),
    };
  }

  @Get(':id')
  async getById(@Param('id', zodPipe(uuidSchema)) id: string) {
    return this.cardsService.getById(id);
  }
}
