import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { DATABASE, type Database } from '../db/database.module'
import {
  cards,
  deckCards,
  decks,
  DECK_FORMATS,
  printings,
  type DeckFormat,
} from '../db/schema'
import { UsersService } from '../users/users.service'
import type { CreateDeckInput, Deck, DeckCard, DeckDetail, UpdateDeckInput } from './deck.types'

type DeckRow = {
  id: string
  name: string
  description: string | null
  format: string
  updatedAt: Date
}

type DeckCardRow = {
  id: string
  card_id: string
  printing_id: string
  name: string
  mana_cost: string | null
  mana_value: string | null
  type_line: string | null
  quantity: number
  set_code: string
  set_name: string
  collector_number: string
  image_normal: string | null
}

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
      .select({
        id: decks.id,
        name: decks.name,
        description: decks.description,
        format: decks.format,
        updatedAt: decks.updatedAt,
      })
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

  async createForUser(clerkUserId: string, input: CreateDeckInput): Promise<Deck> {
    const userId = await this.users.resolveLocalId(clerkUserId)
    const description = input.description?.trim() || null
    const [row] = await this.db
      .insert(decks)
      .values({
        userId,
        name: input.name,
        description,
        format: input.format,
      })
      .returning({
        id: decks.id,
        name: decks.name,
        description: decks.description,
        format: decks.format,
        updatedAt: decks.updatedAt,
      })

    this.logger.info(
      {
        event: 'decks.create',
        userId: clerkUserId,
        deckId: row.id,
        format: row.format,
      },
      'Created deck for user',
    )

    return toDeck(row)
  }

  async updateForUser(
    clerkUserId: string,
    deckId: string,
    input: UpdateDeckInput,
  ): Promise<Deck> {
    const existing = await this.requireOwnedDeck(clerkUserId, deckId)

    const patch: {
      name?: string
      description?: string | null
      format?: DeckFormat
      updatedAt?: Date
    } = {}

    if (input.name !== undefined) {
      patch.name = input.name.trim()
    }
    if (input.description !== undefined) {
      patch.description =
        typeof input.description === 'string'
          ? input.description.trim() || null
          : null
    }
    if (input.format !== undefined) {
      patch.format = input.format
    }

    if (Object.keys(patch).length === 0) {
      return existing
    }

    patch.updatedAt = new Date()

    const [row] = await this.db
      .update(decks)
      .set(patch)
      .where(eq(decks.id, deckId))
      .returning({
        id: decks.id,
        name: decks.name,
        description: decks.description,
        format: decks.format,
        updatedAt: decks.updatedAt,
      })

    this.logger.info(
      {
        event: 'decks.update',
        userId: clerkUserId,
        deckId,
        fields: Object.keys(input).filter(
          (key) => input[key as keyof UpdateDeckInput] !== undefined,
        ),
      },
      'Updated deck',
    )

    return toDeck(row)
  }

  async deleteForUser(clerkUserId: string, deckId: string): Promise<void> {
    await this.requireOwnedDeck(clerkUserId, deckId)

    await this.db.delete(decks).where(eq(decks.id, deckId))

    this.logger.info(
      {
        event: 'decks.delete',
        userId: clerkUserId,
        deckId,
      },
      'Deleted deck',
    )
  }

  async getForUser(clerkUserId: string, deckId: string): Promise<DeckDetail> {
    const deck = await this.requireOwnedDeck(clerkUserId, deckId)
    const result = await this.db.execute<DeckCardRow>(sql`
      SELECT
        dc.id,
        c.id AS card_id,
        p.id AS printing_id,
        c.name,
        c.mana_cost,
        c.mana_value::text AS mana_value,
        c.type_line,
        dc.quantity,
        s.code AS set_code,
        s.name AS set_name,
        p.collector_number,
        COALESCE(p.image_normal, f.image_normal) AS image_normal
      FROM app.deck_card dc
      JOIN catalog.printing p ON p.id = dc.printing_id
      JOIN catalog.card c ON c.id = p.card_id
      JOIN catalog.set s ON s.id = p.set_id
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE dc.deck_id = ${deckId}::uuid
      ORDER BY c.name ASC, s.code ASC, p.collector_number ASC
    `)

    return {
      deck,
      cards: result.rows.map(toDeckCard),
    }
  }

  /** Add by oracle card: resolves a default printing, then stacks on that printing. */
  async addCard(
    clerkUserId: string,
    deckId: string,
    cardId: string,
  ): Promise<DeckCard> {
    await this.requireOwnedDeck(clerkUserId, deckId)

    const [card] = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1)
    if (!card) {
      throw new NotFoundException('Card not found')
    }

    const printingId = await this.defaultPrintingId(cardId)
    if (!printingId) {
      throw new BadRequestException('Card has no printings')
    }

    const row = await this.upsertPrintingLine(deckId, printingId, 1)

    await this.touchDeck(deckId)

    this.logger.info(
      {
        event: 'decks.card_add',
        userId: clerkUserId,
        deckId,
        cardId,
        printingId,
        quantity: row.quantity,
      },
      'Added card printing to deck',
    )

    return this.requireDeckCard(row.id)
  }

  async setCardQuantity(
    clerkUserId: string,
    deckId: string,
    deckCardId: string,
    quantity: number,
  ): Promise<DeckCard | null> {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new BadRequestException('quantity must be a non-negative integer')
    }

    await this.requireOwnedDeck(clerkUserId, deckId)

    if (quantity === 0) {
      await this.removeCard(clerkUserId, deckId, deckCardId)
      return null
    }

    const [row] = await this.db
      .update(deckCards)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(deckCards.id, deckCardId), eq(deckCards.deckId, deckId)))
      .returning({ id: deckCards.id })

    if (!row) {
      throw new NotFoundException('Deck card not found')
    }

    await this.touchDeck(deckId)
    return this.requireDeckCard(row.id)
  }

  async setCardPrinting(
    clerkUserId: string,
    deckId: string,
    deckCardId: string,
    printingId: string,
  ): Promise<DeckCard> {
    await this.requireOwnedDeck(clerkUserId, deckId)

    const [line] = await this.db
      .select({
        id: deckCards.id,
        printingId: deckCards.printingId,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(and(eq(deckCards.id, deckCardId), eq(deckCards.deckId, deckId)))
      .limit(1)

    if (!line) {
      throw new NotFoundException('Deck card not found')
    }

    if (line.printingId === printingId) {
      return this.requireDeckCard(line.id)
    }

    const [current] = await this.db
      .select({ cardId: printings.cardId })
      .from(printings)
      .where(eq(printings.id, line.printingId))
      .limit(1)

    const [next] = await this.db
      .select({ id: printings.id, cardId: printings.cardId })
      .from(printings)
      .where(eq(printings.id, printingId))
      .limit(1)

    if (!next) {
      throw new NotFoundException('Printing not found')
    }
    if (!current || next.cardId !== current.cardId) {
      throw new BadRequestException(
        'Printing must belong to the same card as the deck line',
      )
    }

    const [existing] = await this.db
      .select({
        id: deckCards.id,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(
        and(eq(deckCards.deckId, deckId), eq(deckCards.printingId, printingId)),
      )
      .limit(1)

    let survivorId: string
    if (existing) {
      const [merged] = await this.db
        .update(deckCards)
        .set({
          quantity: existing.quantity + line.quantity,
          updatedAt: new Date(),
        })
        .where(eq(deckCards.id, existing.id))
        .returning({ id: deckCards.id })
      await this.db.delete(deckCards).where(eq(deckCards.id, line.id))
      survivorId = merged.id
    } else {
      const [updated] = await this.db
        .update(deckCards)
        .set({ printingId, updatedAt: new Date() })
        .where(eq(deckCards.id, line.id))
        .returning({ id: deckCards.id })
      survivorId = updated.id
    }

    await this.touchDeck(deckId)

    this.logger.info(
      {
        event: 'decks.card_printing_set',
        userId: clerkUserId,
        deckId,
        deckCardId,
        printingId,
        survivorId,
      },
      'Changed deck card printing',
    )

    return this.requireDeckCard(survivorId)
  }

  async removeCard(
    clerkUserId: string,
    deckId: string,
    deckCardId: string,
  ): Promise<void> {
    await this.requireOwnedDeck(clerkUserId, deckId)

    const deleted = await this.db
      .delete(deckCards)
      .where(and(eq(deckCards.id, deckCardId), eq(deckCards.deckId, deckId)))
      .returning({ id: deckCards.id })

    if (deleted.length === 0) {
      throw new NotFoundException('Deck card not found')
    }

    await this.touchDeck(deckId)

    this.logger.info(
      {
        event: 'decks.card_remove',
        userId: clerkUserId,
        deckId,
        deckCardId,
      },
      'Removed card from deck',
    )
  }

  private async upsertPrintingLine(
    deckId: string,
    printingId: string,
    addQuantity: number,
  ): Promise<{ id: string; quantity: number }> {
    const [existing] = await this.db
      .select({
        id: deckCards.id,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(
        and(eq(deckCards.deckId, deckId), eq(deckCards.printingId, printingId)),
      )
      .limit(1)

    if (existing) {
      const [updated] = await this.db
        .update(deckCards)
        .set({
          quantity: existing.quantity + addQuantity,
          updatedAt: new Date(),
        })
        .where(eq(deckCards.id, existing.id))
        .returning({ id: deckCards.id, quantity: deckCards.quantity })
      return updated
    }

    const [inserted] = await this.db
      .insert(deckCards)
      .values({ deckId, printingId, quantity: addQuantity })
      .returning({ id: deckCards.id, quantity: deckCards.quantity })
    return inserted
  }

  private async defaultPrintingId(cardId: string): Promise<string | null> {
    const result = await this.db.execute<{ id: string }>(sql`
      SELECT p.id
      FROM catalog.printing p
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE p.card_id = ${cardId}::uuid
      ORDER BY
        (p.image_normal IS NOT NULL OR f.image_normal IS NOT NULL) DESC,
        p.released_at DESC NULLS LAST,
        p.id
      LIMIT 1
    `)
    return result.rows[0]?.id ?? null
  }

  private async requireDeckCard(deckCardId: string): Promise<DeckCard> {
    const result = await this.db.execute<DeckCardRow>(sql`
      SELECT
        dc.id,
        c.id AS card_id,
        p.id AS printing_id,
        c.name,
        c.mana_cost,
        c.mana_value::text AS mana_value,
        c.type_line,
        dc.quantity,
        s.code AS set_code,
        s.name AS set_name,
        p.collector_number,
        COALESCE(p.image_normal, f.image_normal) AS image_normal
      FROM app.deck_card dc
      JOIN catalog.printing p ON p.id = dc.printing_id
      JOIN catalog.card c ON c.id = p.card_id
      JOIN catalog.set s ON s.id = p.set_id
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE dc.id = ${deckCardId}::uuid
      LIMIT 1
    `)
    const row = result.rows[0]
    if (!row) {
      throw new NotFoundException('Deck card not found')
    }
    return toDeckCard(row)
  }

  private async requireOwnedDeck(
    clerkUserId: string,
    deckId: string,
  ): Promise<Deck> {
    const userId = await this.users.resolveLocalId(clerkUserId)
    const [row] = await this.db
      .select({
        id: decks.id,
        name: decks.name,
        description: decks.description,
        format: decks.format,
        updatedAt: decks.updatedAt,
      })
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .limit(1)

    if (!row) {
      throw new NotFoundException('Deck not found')
    }

    return toDeck(row)
  }

  private async touchDeck(deckId: string): Promise<void> {
    await this.db
      .update(decks)
      .set({ updatedAt: new Date() })
      .where(eq(decks.id, deckId))
  }
}

export function parseDeckFormat(raw: unknown): DeckFormat {
  if (typeof raw !== 'string' || !(DECK_FORMATS as readonly string[]).includes(raw)) {
    throw new BadRequestException(
      `format must be one of: ${DECK_FORMATS.join(', ')}`,
    )
  }
  return raw as DeckFormat
}

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    format: normalizeFormat(row.format),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toDeckCard(row: DeckCardRow): DeckCard {
  return {
    id: row.id,
    cardId: row.card_id,
    printingId: row.printing_id,
    name: row.name,
    manaCost: row.mana_cost,
    manaValue: row.mana_value,
    typeLine: row.type_line,
    quantity: row.quantity,
    setCode: row.set_code,
    setName: row.set_name,
    collectorNumber: row.collector_number,
    imageNormal: row.image_normal,
  }
}

function normalizeFormat(raw: string): DeckFormat {
  if ((DECK_FORMATS as readonly string[]).includes(raw)) {
    return raw as DeckFormat
  }
  return 'standard'
}
