import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { uuidSchema } from '@respark/schemas/primitives';
import {
  SET_PRINTINGS_DEFAULT_LIMIT,
  SET_PRINTING_DEFAULT_SORT,
  SET_SEARCH_DEFAULT_LIMIT,
  SET_SEARCH_DEFAULT_SORT,
  SET_TYPE_SUGGESTIONS_DEFAULT_LIMIT,
  setDetailQuerySchema,
  setSearchQuerySchema,
  setTypeSuggestionsQuerySchema,
  type SetDetailQuery,
  type SetSearchQuery,
  type SetTypeSuggestionsQuery,
} from '@respark/schemas/sets';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { zodPipe } from '../lib/zod-pipe';

import { SetsService } from './sets.service';

@Controller('sets')
@UseGuards(ClerkAuthGuard)
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  @Get()
  async search(@Query(zodPipe(setSearchQuerySchema)) query: SetSearchQuery) {
    return this.setsService.search({
      q: query.q,
      setType: query.setType,
      sort: query.sort ?? SET_SEARCH_DEFAULT_SORT,
      dir: query.dir,
      limit: query.limit ?? SET_SEARCH_DEFAULT_LIMIT,
      page: query.page ?? 1,
    });
  }

  /** Distinct set_type values from the catalog for bounded autocomplete. */
  @Get('type-suggestions')
  async typeSuggestions(
    @Query(zodPipe(setTypeSuggestionsQuerySchema)) query: SetTypeSuggestionsQuery,
  ) {
    return {
      suggestions: await this.setsService.suggestSetTypes(query.q, {
        limit: query.limit ?? SET_TYPE_SUGGESTIONS_DEFAULT_LIMIT,
      }),
    };
  }

  @Get(':id')
  async getById(
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Query(zodPipe(setDetailQuerySchema)) query: SetDetailQuery,
  ) {
    return this.setsService.getById(id, {
      sort: query.sort ?? SET_PRINTING_DEFAULT_SORT,
      dir: query.dir,
      limit: query.limit ?? SET_PRINTINGS_DEFAULT_LIMIT,
      page: query.page ?? 1,
    });
  }
}
