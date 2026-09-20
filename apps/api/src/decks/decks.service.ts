import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  COLOR_IDENTITY_PIPS,
  colorIdentityPipSchema,
  deckFormatSchema,
  type ColorIdentityPip,
  type CreateDeckInput,
  type Deck,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
  type DeckImportResult,
  type PatchDeckCardBody,
  type UpdateDeckInput,
} from 'schemas/decks';
import { defaultPrintingId, resolveMoxfieldPrintings } from '../catalog/printings';
import { DATABASE, type Database } from '../db/database.module';
import { cards, deckCards, decks, printings } from '../db/schema';
import { UsersService } from '../users/users.service';
import { parseMoxfieldExport } from './moxfield-import';

type DeckRow = {
  id: string;
  name: string;
  description: string | null;
  format: string;
  updatedAt: Date;
};

type DeckCardRow = {
  id: string;
  card_id: string;
  printing_id: string;
  name: string;
  mana_cost: string | null;
  mana_value: string | null;
  type_line: string | null;
  oracle_text: string | null;
  color_identity: string[] | null;
  foil: boolean;
  sideboard: boolean;
  quantity: number;
  set_code: string;
  set_name: string;
  collector_number: string;
  image_normal: string | null;
  finishes: string[] | null;
};

type DeckLine = {
  id: string;
  printingId: string;
  foil: boolean;
  sideboard: boolean;
  quantity: number;
};

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
    const userId = await this.users.resolveLocalId(clerkUserId);
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
      .orderBy(desc(decks.updatedAt));

    this.logger.info(
      {
        event: 'decks.list',
        userId: clerkUserId,
        deckCount: rows.length,
      },
      'Listed decks for user',
    );

    const colorByDeck = await this.colorIdentityByDeck(rows.map((row) => row.id));
    return rows.map((row) => toDeck(row, this.logger, colorByDeck.get(row.id) ?? []));
  }

  private async colorIdentityByDeck(deckIds: string[]): Promise<Map<string, ColorIdentityPip[]>> {
    const byDeck = new Map<string, ColorIdentityPip[]>();
    if (deckIds.length === 0) return byDeck;

    const rows = await this.db
      .select({
        deckId: deckCards.deckId,
        colorIdentity: cards.colorIdentity,
      })
      .from(deckCards)
      .innerJoin(printings, eq(deckCards.printingId, printings.id))
      .innerJoin(cards, eq(printings.cardId, cards.id))
      .where(and(inArray(deckCards.deckId, deckIds), eq(deckCards.sideboard, false)));

    const seen = new Map<string, Set<ColorIdentityPip>>();
    for (const row of rows) {
      const set = seen.get(row.deckId) ?? new Set<ColorIdentityPip>();
      for (const raw of row.colorIdentity ?? []) {
        const pip = colorIdentityPipSchema.safeParse(raw);
        if (pip.success) set.add(pip.data);
      }
      seen.set(row.deckId, set);
    }

    for (const [deckId, set] of seen) {
      byDeck.set(
        deckId,
        COLOR_IDENTITY_PIPS.filter((pip) => set.has(pip)),
      );
    }
    return byDeck;
  }

  async createForUser(clerkUserId: string, input: CreateDeckInput): Promise<Deck> {
    const userId = await this.users.resolveLocalId(clerkUserId);
    const description = input.description?.trim() || null;
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
      });

    this.logger.info(
      {
        event: 'decks.create',
        userId: clerkUserId,
        deckId: row.id,
        format: row.format,
      },
      'Created deck for user',
    );

    return toDeck(row, this.logger);
  }

  async updateForUser(clerkUserId: string, deckId: string, input: UpdateDeckInput): Promise<Deck> {
    await this.requireOwnedDeck(clerkUserId, deckId);

    const patch: {
      name?: string;
      description?: string | null;
      format?: DeckFormat;
      updatedAt?: Date;
    } = {};

    if (input.name !== undefined) {
      patch.name = input.name;
    }
    if (input.description !== undefined) {
      patch.description = input.description?.trim() || null;
    }
    if (input.format !== undefined) {
      patch.format = input.format;
    }

    patch.updatedAt = new Date();

    const [row] = await this.db.update(decks).set(patch).where(eq(decks.id, deckId)).returning({
      id: decks.id,
      name: decks.name,
      description: decks.description,
      format: decks.format,
      updatedAt: decks.updatedAt,
    });

    this.logger.info(
      {
        event: 'decks.update',
        userId: clerkUserId,
        deckId,
      },
      'Updated deck',
    );

    return toDeck(row, this.logger);
  }

  async deleteForUser(clerkUserId: string, deckId: string): Promise<void> {
    await this.requireOwnedDeck(clerkUserId, deckId);

    await this.db.delete(decks).where(eq(decks.id, deckId));

    this.logger.info(
      {
        event: 'decks.delete',
        userId: clerkUserId,
        deckId,
      },
      'Deleted deck',
    );
  }

  async importMoxfield(
    clerkUserId: string,
    deckId: string,
    text: string,
  ): Promise<DeckImportResult> {
    await this.requireOwnedDeck(clerkUserId, deckId);

    const { lines, skipped } = parseMoxfieldExport(text);
    const unmatched = skipped.map((row) => ({
      line: row.raw,
      reason: row.reason,
    }));

    const printingIds = await resolveMoxfieldPrintings(this.db, lines);
    const finishesByPrinting = await this.finishesByPrintingId(
      printingIds.filter((id): id is string => Boolean(id)),
    );

    /** Aggregate by printing + foil + board. */
    const quantities = new Map<
      string,
      { printingId: string; foil: boolean; sideboard: boolean; quantity: number }
    >();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const printingId = printingIds[i];
      if (!printingId) {
        unmatched.push({
          line: line.raw,
          reason: `no printing for ${line.setCode} #${line.collectorNumber}`,
        });
        continue;
      }
      const wantsFoil = line.tags.some((tag) => tag.toUpperCase() === 'F');
      const foil = wantsFoil && printingAllowsFoil(finishesByPrinting.get(printingId) ?? []);
      const key = `${printingId}:${foil ? '1' : '0'}:${line.sideboard ? '1' : '0'}`;
      const existing = quantities.get(key);
      if (existing) {
        existing.quantity += line.quantity;
      } else {
        quantities.set(key, {
          printingId,
          foil,
          sideboard: line.sideboard,
          quantity: line.quantity,
        });
      }
    }

    let imported = 0;
    for (const entry of quantities.values()) {
      await this.upsertPrintingLine(
        deckId,
        entry.printingId,
        entry.quantity,
        entry.foil,
        entry.sideboard,
      );
      imported += 1;
    }

    if (imported > 0) {
      await this.touchDeck(deckId);
    }

    this.logger.info(
      {
        event: 'decks.import',
        userId: clerkUserId,
        deckId,
        imported,
        unmatched: unmatched.length,
        lineCount: lines.length,
      },
      'Imported deck list',
    );

    return {
      imported,
      unmatched,
      detail: await this.getForUser(clerkUserId, deckId),
    };
  }

  async getForUser(clerkUserId: string, deckId: string): Promise<DeckDetail> {
    const deck = await this.requireOwnedDeck(clerkUserId, deckId);
    const rows = await this.selectDeckCards(sql`dc.deck_id = ${deckId}::uuid`);

    return {
      deck,
      cards: rows.map(toDeckCard),
    };
  }

  /** Add by oracle card: resolves a default printing, then stacks on that printing. */
  async addCard(clerkUserId: string, deckId: string, cardId: string): Promise<DeckCard> {
    await this.requireOwnedDeck(clerkUserId, deckId);

    const [card] = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);
    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const printingId = await defaultPrintingId(this.db, cardId);
    if (!printingId) {
      throw new BadRequestException('Card has no printings');
    }

    const row = await this.upsertPrintingLine(deckId, printingId, 1, false, false);

    await this.touchDeck(deckId);

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
    );

    return this.requireDeckCard(row.id);
  }

  async patchDeckCard(
    clerkUserId: string,
    deckId: string,
    deckCardId: string,
    patch: PatchDeckCardBody,
  ): Promise<DeckCard | null> {
    await this.requireOwnedDeck(clerkUserId, deckId);

    let lineId = deckCardId;
    let card: DeckCard | null | undefined;

    if (patch.printingId !== undefined) {
      card = await this.relocateLine(deckId, lineId, { printingId: patch.printingId });
      lineId = card.id;
    }

    if (patch.foil !== undefined) {
      card = await this.relocateLine(deckId, lineId, { foil: patch.foil });
      lineId = card.id;
    }

    if (patch.sideboard !== undefined) {
      card = await this.relocateLine(deckId, lineId, { sideboard: patch.sideboard });
      lineId = card.id;
    }

    if (patch.quantity !== undefined) {
      card = await this.setLineQuantity(deckId, lineId, patch.quantity);
    }

    if (card === undefined) {
      card = await this.requireDeckCard(lineId);
    }

    await this.touchDeck(deckId);

    this.logger.info(
      {
        event: 'decks.card_patch',
        userId: clerkUserId,
        deckId,
        deckCardId,
        lineId,
        printingId: patch.printingId ?? null,
        foil: patch.foil ?? null,
        sideboard: patch.sideboard ?? null,
        quantity: patch.quantity ?? null,
      },
      'Patched deck card',
    );

    return card;
  }

  async removeCard(clerkUserId: string, deckId: string, deckCardId: string): Promise<void> {
    await this.requireOwnedDeck(clerkUserId, deckId);
    await this.deleteLine(deckId, deckCardId);
    await this.touchDeck(deckId);

    this.logger.info(
      {
        event: 'decks.card_remove',
        userId: clerkUserId,
        deckId,
        deckCardId,
      },
      'Removed card from deck',
    );
  }

  private async setLineQuantity(
    deckId: string,
    deckCardId: string,
    quantity: number,
  ): Promise<DeckCard | null> {
    if (quantity === 0) {
      await this.deleteLine(deckId, deckCardId);
      return null;
    }

    const [row] = await this.db
      .update(deckCards)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(deckCards.id, deckCardId), eq(deckCards.deckId, deckId)))
      .returning({ id: deckCards.id });

    if (!row) {
      throw new NotFoundException('Deck card not found');
    }

    return this.requireDeckCard(row.id);
  }

  private async relocateLine(
    deckId: string,
    deckCardId: string,
    next: { printingId?: string; foil?: boolean; sideboard?: boolean },
  ): Promise<DeckCard> {
    const line = await this.loadLine(deckId, deckCardId);
    const printingId = next.printingId ?? line.printingId;
    const foil = next.foil ?? line.foil;
    const sideboard = next.sideboard ?? line.sideboard;

    if (line.printingId === printingId && line.foil === foil && line.sideboard === sideboard) {
      return this.requireDeckCard(line.id);
    }

    if (next.foil === true || (foil && next.printingId !== undefined)) {
      await this.assertPrintingAllowsFoil(printingId);
    }

    if (next.printingId !== undefined) {
      await this.assertSameCard(line.printingId, printingId);
    }

    const survivorId = await this.moveLineToPrinting(deckId, line, printingId, foil, sideboard);
    return this.requireDeckCard(survivorId);
  }

  private async assertSameCard(currentPrintingId: string, nextPrintingId: string): Promise<void> {
    const [current] = await this.db
      .select({ cardId: printings.cardId })
      .from(printings)
      .where(eq(printings.id, currentPrintingId))
      .limit(1);

    const [next] = await this.db
      .select({ id: printings.id, cardId: printings.cardId })
      .from(printings)
      .where(eq(printings.id, nextPrintingId))
      .limit(1);

    if (!next) {
      throw new NotFoundException('Printing not found');
    }
    if (!current || next.cardId !== current.cardId) {
      throw new BadRequestException('Printing must belong to the same card as the deck line');
    }
  }

  private async loadLine(deckId: string, deckCardId: string): Promise<DeckLine> {
    const [line] = await this.db
      .select({
        id: deckCards.id,
        printingId: deckCards.printingId,
        foil: deckCards.foil,
        sideboard: deckCards.sideboard,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(and(eq(deckCards.id, deckCardId), eq(deckCards.deckId, deckId)))
      .limit(1);

    if (!line) {
      throw new NotFoundException('Deck card not found');
    }

    return line;
  }

  private async deleteLine(deckId: string, deckCardId: string): Promise<void> {
    const deleted = await this.db
      .delete(deckCards)
      .where(and(eq(deckCards.id, deckCardId), eq(deckCards.deckId, deckId)))
      .returning({ id: deckCards.id });

    if (deleted.length === 0) {
      throw new NotFoundException('Deck card not found');
    }
  }

  private async finishesByPrintingId(printingIds: string[]): Promise<Map<string, string[]>> {
    const unique = [...new Set(printingIds)];
    if (unique.length === 0) return new Map();

    const rows = await this.db
      .select({ id: printings.id, finishes: printings.finishes })
      .from(printings)
      .where(inArray(printings.id, unique));

    return new Map(rows.map((row) => [row.id, row.finishes ?? []]));
  }

  private async assertPrintingAllowsFoil(printingId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: printings.id, finishes: printings.finishes })
      .from(printings)
      .where(eq(printings.id, printingId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Printing not found');
    }
    if (!printingAllowsFoil(row.finishes ?? [])) {
      throw new BadRequestException('This printing has no foil finish');
    }
  }

  private async upsertPrintingLine(
    deckId: string,
    printingId: string,
    addQuantity: number,
    foil: boolean,
    sideboard: boolean,
  ): Promise<{ id: string; quantity: number }> {
    if (foil) {
      await this.assertPrintingAllowsFoil(printingId);
    }

    const existing = await this.findLineByKey(deckId, printingId, foil, sideboard);

    if (existing) {
      const [updated] = await this.db
        .update(deckCards)
        .set({
          quantity: existing.quantity + addQuantity,
          updatedAt: new Date(),
        })
        .where(eq(deckCards.id, existing.id))
        .returning({ id: deckCards.id, quantity: deckCards.quantity });
      return updated;
    }

    const [inserted] = await this.db
      .insert(deckCards)
      .values({ deckId, printingId, foil, sideboard, quantity: addQuantity })
      .returning({ id: deckCards.id, quantity: deckCards.quantity });
    return inserted;
  }

  /** Move/merge a deck line onto a printing + foil + board key. */
  private async moveLineToPrinting(
    deckId: string,
    line: { id: string; quantity: number },
    printingId: string,
    foil: boolean,
    sideboard: boolean,
  ): Promise<string> {
    const existing = await this.findLineByKey(deckId, printingId, foil, sideboard);

    if (existing && existing.id !== line.id) {
      const [merged] = await this.db
        .update(deckCards)
        .set({
          quantity: existing.quantity + line.quantity,
          updatedAt: new Date(),
        })
        .where(eq(deckCards.id, existing.id))
        .returning({ id: deckCards.id });
      await this.db.delete(deckCards).where(eq(deckCards.id, line.id));
      return merged.id;
    }

    const [updated] = await this.db
      .update(deckCards)
      .set({ printingId, foil, sideboard, updatedAt: new Date() })
      .where(eq(deckCards.id, line.id))
      .returning({ id: deckCards.id });
    return updated.id;
  }

  private async findLineByKey(
    deckId: string,
    printingId: string,
    foil: boolean,
    sideboard: boolean,
  ): Promise<{ id: string; quantity: number } | undefined> {
    const [existing] = await this.db
      .select({
        id: deckCards.id,
        quantity: deckCards.quantity,
      })
      .from(deckCards)
      .where(
        and(
          eq(deckCards.deckId, deckId),
          eq(deckCards.printingId, printingId),
          eq(deckCards.foil, foil),
          eq(deckCards.sideboard, sideboard),
        ),
      )
      .limit(1);
    return existing;
  }

  private async selectDeckCards(whereSql: SQL): Promise<DeckCardRow[]> {
    const result = await this.db.execute<DeckCardRow>(sql`
      SELECT
        dc.id,
        c.id AS card_id,
        p.id AS printing_id,
        c.name,
        c.mana_cost,
        c.mana_value::text AS mana_value,
        c.type_line,
        c.oracle_text,
        c.color_identity,
        dc.foil,
        dc.sideboard,
        dc.quantity,
        s.code AS set_code,
        s.name AS set_name,
        p.collector_number,
        COALESCE(p.image_normal, f.image_normal) AS image_normal,
        p.finishes
      FROM app.deck_card dc
      JOIN catalog.printing p ON p.id = dc.printing_id
      JOIN catalog.card c ON c.id = p.card_id
      JOIN catalog.set s ON s.id = p.set_id
      LEFT JOIN catalog.card_face f
        ON f.printing_id = p.id AND f.face_index = 0
      WHERE ${whereSql}
      ORDER BY dc.sideboard ASC, c.name ASC, s.code ASC, p.collector_number ASC, dc.foil ASC
    `);
    return result.rows;
  }

  private async requireDeckCard(deckCardId: string): Promise<DeckCard> {
    const rows = await this.selectDeckCards(sql`dc.id = ${deckCardId}::uuid`);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Deck card not found');
    }
    return toDeckCard(row);
  }

  private async requireOwnedDeck(clerkUserId: string, deckId: string): Promise<Deck> {
    const userId = await this.users.resolveLocalId(clerkUserId);
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
      .limit(1);

    if (!row) {
      throw new NotFoundException('Deck not found');
    }

    return toDeck(row, this.logger);
  }

  private async touchDeck(deckId: string): Promise<void> {
    await this.db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));
  }
}

const toDeck = (row: DeckRow, logger: PinoLogger, colorIdentity: ColorIdentityPip[] = []): Deck => {
  const format = deckFormatSchema.safeParse(row.format);
  if (!format.success) {
    logger.warn(
      { event: 'decks.invalid_format', deckId: row.id, format: row.format },
      'Deck has an unknown format; expected a known enum value',
    );
    throw new Error(`Invalid deck format "${row.format}"`);
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    format: format.data,
    colorIdentity,
    updatedAt: row.updatedAt.toISOString(),
  };
};

const toDeckCard = (row: DeckCardRow): DeckCard => ({
  id: row.id,
  cardId: row.card_id,
  printingId: row.printing_id,
  name: row.name,
  manaCost: row.mana_cost,
  manaValue: row.mana_value,
  typeLine: row.type_line,
  oracleText: row.oracle_text,
  colorIdentity: parseColorIdentity(row.color_identity),
  foil: row.foil && printingAllowsFoil(row.finishes ?? []),
  hasFoil: printingAllowsFoil(row.finishes ?? []),
  sideboard: row.sideboard,
  quantity: row.quantity,
  setCode: row.set_code,
  setName: row.set_name,
  collectorNumber: row.collector_number,
  imageNormal: row.image_normal,
});

const printingAllowsFoil = (finishes: readonly string[]): boolean =>
  finishes.length === 0 || finishes.includes('foil');

const parseColorIdentity = (raw: string[] | null): ColorIdentityPip[] => {
  const seen = new Set<ColorIdentityPip>();
  for (const value of raw ?? []) {
    const pip = colorIdentityPipSchema.safeParse(value);
    if (pip.success) seen.add(pip.data);
  }
  return COLOR_IDENTITY_PIPS.filter((pip) => seen.has(pip));
};
