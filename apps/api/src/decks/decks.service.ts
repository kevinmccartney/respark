import { Inject, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { DATABASE, type Database } from '../db/database.module'
import { decks } from '../db/schema'
import { UsersService } from '../users/users.service'
import type { Deck } from './deck.types'

@Injectable()
export class DecksService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly users: UsersService,
    @InjectPinoLogger(DecksService.name)
    private readonly logger: PinoLogger,
  ) {}

  async listForUser(clerkUserId: string): Promise<Deck[]> {
    const userId = await this.users.resolveLocalId(clerkUserId)
    const rows = await this.db
      .select({ id: decks.id, name: decks.name, updatedAt: decks.updatedAt })
      .from(decks)
      .where(eq(decks.userId, userId))
      .orderBy(desc(decks.updatedAt))

    this.logger.info(
      {
        event: 'decks.list',
        userId: clerkUserId,
        deckCount: rows.length,
      },
      'Listed decks for user',
    )

    return rows.map(toDeck)
  }

  async createForUser(clerkUserId: string, name: string): Promise<Deck> {
    const userId = await this.users.resolveLocalId(clerkUserId)
    const [row] = await this.db
      .insert(decks)
      .values({ userId, name })
      .returning({ id: decks.id, name: decks.name, updatedAt: decks.updatedAt })

    this.logger.info(
      {
        event: 'decks.create',
        userId: clerkUserId,
        deckId: row.id,
      },
      'Created deck for user',
    )

    return toDeck(row)
  }
}

function toDeck(row: { id: string; name: string; updatedAt: Date }): Deck {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  }
}
