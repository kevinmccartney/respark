import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ClerkAuthGuard } from '../auth/clerk-auth.guard'
import { CurrentUserId } from '../auth/current-user.decorator'
import { DecksService, parseDeckFormat } from './decks.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

@Controller('decks')
@UseGuards(ClerkAuthGuard)
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return {
      decks: await this.decksService.listForUser(userId),
    }
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body()
    body: {
      name?: unknown
      description?: unknown
      format?: unknown
    },
  ) {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) {
      throw new BadRequestException('name is required')
    }
    const description =
      typeof body?.description === 'string' ? body.description : null
    const format = parseDeckFormat(body?.format ?? 'standard')

    return {
      deck: await this.decksService.createForUser(userId, {
        name,
        description,
        format,
      }),
    }
  }

  @Get(':id')
  async get(@CurrentUserId() userId: string, @Param('id') id: string) {
    requireUuid(id, 'deck id')
    return this.decksService.getForUser(userId, id)
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    requireUuid(id, 'deck id')

    const patch: {
      name?: string
      description?: string | null
      format?: ReturnType<typeof parseDeckFormat>
    } = {}

    if ('name' in body) {
      if (typeof body.name !== 'string') {
        throw new BadRequestException('name must be a string')
      }
      const name = body.name.trim()
      if (!name) {
        throw new BadRequestException('name cannot be empty')
      }
      patch.name = name
    }

    if ('description' in body) {
      if (body.description !== null && typeof body.description !== 'string') {
        throw new BadRequestException('description must be a string or null')
      }
      patch.description = body.description
    }

    if ('format' in body) {
      patch.format = parseDeckFormat(body.format)
    }

    return {
      deck: await this.decksService.updateForUser(userId, id, patch),
    }
  }

  @Delete(':id')
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    requireUuid(id, 'deck id')
    await this.decksService.deleteForUser(userId, id)
    return { ok: true }
  }

  @Post(':id/import')
  async importList(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: { text?: unknown },
  ) {
    requireUuid(id, 'deck id')
    if (typeof body?.text !== 'string') {
      throw new BadRequestException('text is required')
    }
    return this.decksService.importMoxfield(userId, id, body.text)
  }

  @Post(':id/cards')
  async addCard(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: { cardId?: unknown },
  ) {
    requireUuid(id, 'deck id')
    const cardId = typeof body?.cardId === 'string' ? body.cardId : ''
    requireUuid(cardId, 'cardId')
    return {
      card: await this.decksService.addCard(userId, id, cardId),
    }
  }

  @Patch(':id/cards/:deckCardId')
  async patchCard(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('deckCardId') deckCardId: string,
    @Body()
    body: {
      quantity?: unknown
      printingId?: unknown
      foil?: unknown
      sideboard?: unknown
    },
  ) {
    requireUuid(id, 'deck id')
    requireUuid(deckCardId, 'deck card id')

    const hasQuantity = body?.quantity !== undefined
    const hasPrinting = body?.printingId !== undefined
    const hasFoil = body?.foil !== undefined
    const hasSideboard = body?.sideboard !== undefined
    if (!hasQuantity && !hasPrinting && !hasFoil && !hasSideboard) {
      throw new BadRequestException(
        'quantity, printingId, foil, or sideboard is required',
      )
    }

    let card = null as Awaited<
      ReturnType<DecksService['setCardPrinting']>
    > | null
    let lineId = deckCardId

    if (hasPrinting) {
      const printingId =
        typeof body.printingId === 'string' ? body.printingId : ''
      requireUuid(printingId, 'printingId')
      card = await this.decksService.setCardPrinting(
        userId,
        id,
        lineId,
        printingId,
      )
      lineId = card.id
    }

    if (hasFoil) {
      if (typeof body.foil !== 'boolean') {
        throw new BadRequestException('foil must be a boolean')
      }
      card = await this.decksService.setCardFoil(userId, id, lineId, body.foil)
      lineId = card.id
    }

    if (hasSideboard) {
      if (typeof body.sideboard !== 'boolean') {
        throw new BadRequestException('sideboard must be a boolean')
      }
      card = await this.decksService.setCardSideboard(
        userId,
        id,
        lineId,
        body.sideboard,
      )
      lineId = card.id
    }

    if (hasQuantity) {
      if (typeof body.quantity !== 'number') {
        throw new BadRequestException('quantity must be a number')
      }
      card = await this.decksService.setCardQuantity(
        userId,
        id,
        lineId,
        body.quantity,
      )
    }

    return { card }
  }

  @Delete(':id/cards/:deckCardId')
  async removeCard(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('deckCardId') deckCardId: string,
  ) {
    requireUuid(id, 'deck id')
    requireUuid(deckCardId, 'deck card id')
    await this.decksService.removeCard(userId, id, deckCardId)
    return { ok: true }
  }
}

function requireUuid(value: string, label: string) {
  if (!UUID_RE.test(value)) {
    throw new BadRequestException(`Invalid ${label}`)
  }
}
