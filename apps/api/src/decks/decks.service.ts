import { Injectable } from '@nestjs/common'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import type { Deck } from './deck.types'

@Injectable()
export class DecksService {
  constructor(
    @InjectPinoLogger(DecksService.name)
    private readonly logger: PinoLogger,
  ) {}

  /** Placeholder until deck persistence exists. Scoped by Clerk user id. */
  listForUser(userId: string): Deck[] {
    const decks: Deck[] = []
    this.logger.info(
      {
        event: 'decks.list',
        userId,
        deckCount: decks.length,
      },
      'Listed decks for user',
    )
    return decks
  }
}
