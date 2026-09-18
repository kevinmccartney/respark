import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ClerkAuthGuard } from '../auth/clerk-auth.guard'
import { CurrentUserId } from '../auth/current-user.decorator'
import { DecksService } from './decks.service'

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
  async create(@CurrentUserId() userId: string, @Body() body: { name?: unknown }) {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) {
      throw new BadRequestException('name is required')
    }

    return {
      deck: await this.decksService.createForUser(userId, name),
    }
  }
}
