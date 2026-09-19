import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ClerkAuthGuard } from '../auth/clerk-auth.guard'
import { CardsService } from './cards.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  @Get(':id')
  async getById(@Param('id') id: string) {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException('Invalid card id')
    }
    return this.cardsService.getById(id)
  }
}
