import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ClerkAuthGuard } from '../auth/clerk-auth.guard'
import { CardsService } from './cards.service'

@Controller('cards')
@UseGuards(ClerkAuthGuard)
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  async search(
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('page') pageRaw?: string,
  ) {
    const limit =
      limitRaw === undefined || limitRaw === ''
        ? undefined
        : Number.parseInt(limitRaw, 10)
    const page =
      pageRaw === undefined || pageRaw === ''
        ? undefined
        : Number.parseInt(pageRaw, 10)

    return this.cardsService.search({ q, limit, page })
  }
}
