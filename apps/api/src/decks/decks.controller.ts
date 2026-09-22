import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import {
  addDeckCardBodySchema,
  createDeckBodySchema,
  importDeckBodySchema,
  patchDeckCardBodySchema,
  updateDeckBodySchema,
  type AddDeckCardBody,
  type CreateDeckInput,
  type ImportDeckBody,
  type PatchDeckCardBody,
  type UpdateDeckInput,
} from '@respark/schemas/decks';
import { uuidSchema } from '@respark/schemas/primitives';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { zodPipe } from '../lib/zod-pipe';

import { DecksService } from './decks.service';

@Controller('decks')
@UseGuards(ClerkAuthGuard)
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return {
      decks: await this.decksService.listForUser(userId),
    };
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body(zodPipe(createDeckBodySchema)) body: CreateDeckInput,
  ) {
    return {
      deck: await this.decksService.createForUser(userId, body),
    };
  }

  @Get(':id')
  async get(@CurrentUserId() userId: string, @Param('id', zodPipe(uuidSchema)) id: string) {
    return this.decksService.getForUser(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(updateDeckBodySchema)) body: UpdateDeckInput,
  ) {
    return {
      deck: await this.decksService.updateForUser(userId, id, body),
    };
  }

  @Delete(':id')
  async remove(@CurrentUserId() userId: string, @Param('id', zodPipe(uuidSchema)) id: string) {
    await this.decksService.deleteForUser(userId, id);
    return { ok: true as const };
  }

  @Post(':id/import')
  async importList(
    @CurrentUserId() userId: string,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(importDeckBodySchema)) body: ImportDeckBody,
  ) {
    return this.decksService.importMoxfield(userId, id, body.text);
  }

  @Post(':id/cards')
  async addCard(
    @CurrentUserId() userId: string,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Body(zodPipe(addDeckCardBodySchema)) body: AddDeckCardBody,
  ) {
    return {
      card: await this.decksService.addCard(userId, id, body.cardId),
    };
  }

  @Patch(':id/cards/:deckCardId')
  async patchCard(
    @CurrentUserId() userId: string,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('deckCardId', zodPipe(uuidSchema)) deckCardId: string,
    @Body(zodPipe(patchDeckCardBodySchema)) body: PatchDeckCardBody,
  ) {
    return {
      card: await this.decksService.patchDeckCard(userId, id, deckCardId, body),
    };
  }

  @Delete(':id/cards/:deckCardId')
  async removeCard(
    @CurrentUserId() userId: string,
    @Param('id', zodPipe(uuidSchema)) id: string,
    @Param('deckCardId', zodPipe(uuidSchema)) deckCardId: string,
  ) {
    await this.decksService.removeCard(userId, id, deckCardId);
    return { ok: true as const };
  }
}
