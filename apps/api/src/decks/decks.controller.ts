import { Controller, Get, UseGuards } from '@nestjs/common'
import { ClerkAuthGuard } from '../auth/clerk-auth.guard'
import { CurrentUserId } from '../auth/current-user.decorator'
import { DecksService } from './decks.service'

@Controller('decks')
@UseGuards(ClerkAuthGuard)
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return {
      decks: this.decksService.listForUser(userId),
    }
  }
}
