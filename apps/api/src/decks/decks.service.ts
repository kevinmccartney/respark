import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { isLegalInFormat, isLeadershipCommander, type LeadershipSkills } from 'schemas/cards';
import {
  COLOR_IDENTITY_PIPS,
  colorIdentityPipSchema,
  deckFormatSchema,
  isColorIdentitySubset,
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
import { parseCardFaces } from 'schemas/primitives';
import {
  defaultPrintingId,
  printingFacesJsonSql,
  resolveMoxfieldPrintings,
} from '../catalog/printings';
import { DATABASE, type Database } from '../db/database.module';
import { cards, deckCards, decks, printings } from '../db/schema';
import { UsersService } from '../users/users.service';
import { isIgnoredCommanderImport, parseMoxfieldExport } from './moxfield-import';

type DeckRow = {
  id: string;
  name: string;
  description: string | null;
  format: string;
  commanderPrintingId: string | null;
  updatedAt: Date;
};

type PrintingCatalog = {
  cardId: string;
  name: string;
  legalities: Record<string, string> | null;
  colorIdentity: string[] | null;
  leadershipSkills: LeadershipSkills | null;
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
  faces: unknown;
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
        commanderPrintingId: decks.commanderPrintingId,
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

    const deckRows = await this.db
      .select({
        id: decks.id,
        format: decks.format,
        commanderPrintingId: decks.commanderPrintingId,
      })
      .from(decks)
      .where(inArray(decks.id, deckIds));

    const commanderPrintings = deckRows
      .map((row) => row.commanderPrintingId)
      .filter((id): id is string => Boolean(id));
    const commanderCatalog = await this.catalogByPrintingId(commanderPrintings);

    const constructedIds: string[] = [];
    for (const row of deckRows) {
      if (row.format === 'commander' && row.commanderPrintingId) {
        const catalog = commanderCatalog.get(row.commanderPrintingId);
        byDeck.set(row.id, parseColorIdentity(catalog?.colorIdentity ?? null));
      } else {
        constructedIds.push(row.id);
      }
    }

    if (constructedIds.length === 0) return byDeck;

    const rows = await this.db
      .select({
        deckId: deckCards.deckId,
        colorIdentity: cards.colorIdentity,
      })
      .from(deckCards)
      .innerJoin(printings, eq(deckCards.printingId, printings.id))
      .innerJoin(cards, eq(printings.cardId, cards.id))
      .where(and(inArray(deckCards.deckId, constructedIds), eq(deckCards.sideboard, false)));

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
    const format = input.format;
    const commanderPrintingId = format === 'commander' ? (input.commanderPrintingId ?? null) : null;
    if (format === 'commander') {
      if (!commanderPrintingId) {
        throw new BadRequestException('Commander is required for commander format');
      }
      const catalog = await this.requirePrintingCatalog(commanderPrintingId);
      this.assertLegalInFormat('commander', catalog.legalities, catalog.name);
      this.assertEligibleCommander(catalog);
    }

    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(decks)
        .values({
          userId,
          name: input.name,
          description,
          format,
          commanderPrintingId,
        })
        .returning({
          id: decks.id,
          name: decks.name,
          description: decks.description,
          format: decks.format,
          commanderPrintingId: decks.commanderPrintingId,
          updatedAt: decks.updatedAt,
        });

      if (commanderPrintingId) {
        await tx.insert(deckCards).values({
          deckId: created.id,
          printingId: commanderPrintingId,
          foil: false,
          sideboard: false,
          quantity: 1,
        });
      }

      return created;
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

    return this.toDeckWithColorIdentity(row);
  }

  async updateForUser(clerkUserId: string, deckId: string, input: UpdateDeckInput): Promise<Deck> {
    const current = await this.requireOwnedDeck(clerkUserId, deckId);
    const nextFormat = input.format ?? current.format;
    let nextCommander =
      input.commanderPrintingId !== undefined
        ? input.commanderPrintingId
        : current.commanderPrintingId;
    if (nextFormat !== 'commander') {
      nextCommander = null;
    }
    if (nextFormat === 'commander' && !nextCommander) {
      throw new BadRequestException('Commander is required for commander format');
    }

    const commanderChanged = nextCommander !== current.commanderPrintingId;
    if (nextCommander && commanderChanged) {
      const catalog = await this.requirePrintingCatalog(nextCommander);
      this.assertLegalInFormat('commander', catalog.legalities, catalog.name);
      this.assertEligibleCommander(catalog);
    }

    const row = await this.db.transaction(async (tx) => {
      if (commanderChanged && current.commanderPrintingId) {
        await tx
          .delete(deckCards)
          .where(
            and(
              eq(deckCards.deckId, deckId),
              eq(deckCards.printingId, current.commanderPrintingId),
              eq(deckCards.sideboard, false),
            ),
          );
      }

      if (nextCommander) {
        const existing = await tx
          .select({ id: deckCards.id, quantity: deckCards.quantity })
          .from(deckCards)
          .where(
            and(
              eq(deckCards.deckId, deckId),
              eq(deckCards.printingId, nextCommander),
              eq(deckCards.foil, false),
              eq(deckCards.sideboard, false),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          await tx.insert(deckCards).values({
            deckId,
            printingId: nextCommander,
            foil: false,
            sideboard: false,
            quantity: 1,
          });
        }
      }

      const [updated] = await tx
        .update(decks)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          format: nextFormat,
          commanderPrintingId: nextCommander,
          updatedAt: new Date(),
        })
        .where(eq(decks.id, deckId))
        .returning({
          id: decks.id,
          name: decks.name,
          description: decks.description,
          format: decks.format,
          commanderPrintingId: decks.commanderPrintingId,
          updatedAt: decks.updatedAt,
        });

      if (nextCommander) {
        await this.assertMainboardFitsCommander(tx, deckId, nextCommander, []);
      }

      return updated;
    });

    this.logger.info(
      {
        event: 'decks.update',
        userId: clerkUserId,
        deckId,
      },
      'Updated deck',
    );

    return this.toDeckWithColorIdentity(row);
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
    const deck = await this.requireOwnedDeck(clerkUserId, deckId);

    const { lines, skipped } = parseMoxfieldExport(text);
    const unmatched = skipped.map((row) => ({
      line: row.raw,
      reason: row.reason,
    }));

    const printingIds = await resolveMoxfieldPrintings(this.db, lines);
    const resolvedPrintingIds = printingIds.filter((id): id is string => Boolean(id));
    const catalogLookupIds = deck.commanderPrintingId
      ? [...resolvedPrintingIds, deck.commanderPrintingId]
      : resolvedPrintingIds;
    const finishesByPrinting = await this.finishesByPrintingId(resolvedPrintingIds);
    const catalogByPrinting = await this.catalogByPrintingId(catalogLookupIds);

    if (deck.format === 'commander' && !deck.commanderPrintingId) {
      throw new BadRequestException('Commander is required for commander format');
    }
    const commanderCatalog = deck.commanderPrintingId
      ? (catalogByPrinting.get(deck.commanderPrintingId) ??
        (await this.requirePrintingCatalog(deck.commanderPrintingId)))
      : null;
    const commanderCardId = commanderCatalog?.cardId ?? null;
    const allowedIdentity = commanderCatalog
      ? parseColorIdentity(commanderCatalog.colorIdentity)
      : [];

    /** Aggregate by printing + foil + board. */
    const quantities = new Map<
      string,
      { printingId: string; foil: boolean; sideboard: boolean; quantity: number }
    >();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.commander) continue;
      const printingId = printingIds[i];
      if (!printingId) {
        unmatched.push({
          line: line.raw,
          reason: `no printing for ${line.setCode} #${line.collectorNumber}`,
        });
        continue;
      }
      const catalog = catalogByPrinting.get(printingId);
      if (!catalog) {
        throw new BadRequestException(`No catalog card for ${line.name}`);
      }
      if (isIgnoredCommanderImport(line, catalog.cardId, commanderCardId)) continue;
      this.assertLegalInFormat(deck.format, catalog.legalities, catalog.name);
      if (deck.format === 'commander' && !line.sideboard) {
        this.assertColorIdentity(catalog.colorIdentity, allowedIdentity, catalog.name);
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

    if (deck.format === 'commander' && deck.commanderPrintingId) {
      await this.assertMainboardFitsCommander(this.db, deckId, deck.commanderPrintingId, []);
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
    const deck = await this.requireOwnedDeck(clerkUserId, deckId);

    const [card] = await this.db
      .select({
        id: cards.id,
        name: cards.name,
        legalities: cards.legalities,
        colorIdentity: cards.colorIdentity,
      })
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    this.assertLegalInFormat(deck.format, card.legalities, card.name);
    if (deck.format === 'commander') {
      this.assertColorIdentity(card.colorIdentity, deck.colorIdentity, card.name);
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
    const deck = await this.requireOwnedDeck(clerkUserId, deckId);
    const line = await this.loadLine(deckId, deckCardId);
    const isCommanderLine = deck.commanderPrintingId === line.printingId;

    if (isCommanderLine && (patch.sideboard === true || patch.quantity === 0)) {
      throw new BadRequestException('Cannot sideboard or remove the commander');
    }

    if (patch.sideboard === false && deck.format === 'commander') {
      const catalog = await this.requirePrintingCatalog(line.printingId);
      this.assertColorIdentity(catalog.colorIdentity, deck.colorIdentity, catalog.name);
    }

    let lineId = deckCardId;
    let card: DeckCard | null | undefined;

    if (patch.printingId !== undefined) {
      card = await this.relocateLine(deckId, lineId, { printingId: patch.printingId });
      lineId = card.id;
      if (isCommanderLine && patch.printingId !== line.printingId) {
        const catalog = await this.requirePrintingCatalog(patch.printingId);
        this.assertEligibleCommander(catalog);
        await this.db
          .update(decks)
          .set({ commanderPrintingId: patch.printingId, updatedAt: new Date() })
          .where(eq(decks.id, deckId));
      }
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
    const deck = await this.requireOwnedDeck(clerkUserId, deckId);
    const line = await this.loadLine(deckId, deckCardId);
    if (deck.commanderPrintingId === line.printingId) {
      throw new BadRequestException('Cannot remove the commander');
    }
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
        p.finishes,
        ${printingFacesJsonSql} AS faces
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
        commanderPrintingId: decks.commanderPrintingId,
        updatedAt: decks.updatedAt,
      })
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Deck not found');
    }

    return this.toDeckWithColorIdentity(row);
  }

  private async catalogByPrintingId(printingIds: string[]): Promise<Map<string, PrintingCatalog>> {
    const unique = [...new Set(printingIds)];
    const byPrinting = new Map<string, PrintingCatalog>();
    if (unique.length === 0) return byPrinting;

    const rows = await this.db
      .select({
        printingId: printings.id,
        cardId: cards.id,
        name: cards.name,
        legalities: cards.legalities,
        colorIdentity: cards.colorIdentity,
        leadershipSkills: cards.leadershipSkills,
      })
      .from(printings)
      .innerJoin(cards, eq(printings.cardId, cards.id))
      .where(inArray(printings.id, unique));

    for (const row of rows) {
      byPrinting.set(row.printingId, {
        cardId: row.cardId,
        name: row.name,
        legalities: row.legalities,
        colorIdentity: row.colorIdentity,
        leadershipSkills: row.leadershipSkills,
      });
    }
    return byPrinting;
  }

  private async requirePrintingCatalog(printingId: string): Promise<PrintingCatalog> {
    const catalog = (await this.catalogByPrintingId([printingId])).get(printingId);
    if (!catalog) {
      throw new NotFoundException('Printing not found');
    }
    return catalog;
  }

  private async assertMainboardFitsCommander(
    db: Database,
    deckId: string,
    commanderPrintingId: string,
    exceptPrintingIds: string[],
  ): Promise<void> {
    const commander = (await this.catalogByPrintingId([commanderPrintingId])).get(
      commanderPrintingId,
    );
    if (!commander) {
      throw new NotFoundException('Printing not found');
    }
    const allowed = parseColorIdentity(commander.colorIdentity);

    const rows = await db
      .select({
        printingId: deckCards.printingId,
        name: cards.name,
        colorIdentity: cards.colorIdentity,
      })
      .from(deckCards)
      .innerJoin(printings, eq(deckCards.printingId, printings.id))
      .innerJoin(cards, eq(printings.cardId, cards.id))
      .where(and(eq(deckCards.deckId, deckId), eq(deckCards.sideboard, false)));

    for (const row of rows) {
      if (exceptPrintingIds.includes(row.printingId)) continue;
      this.assertColorIdentity(row.colorIdentity, allowed, row.name);
    }
  }

  private assertEligibleCommander(catalog: PrintingCatalog): void {
    if (isLeadershipCommander(catalog.leadershipSkills)) return;
    throw new BadRequestException(`${catalog.name} cannot be a commander`);
  }

  private assertLegalInFormat(
    format: DeckFormat,
    legalities: Record<string, string> | null,
    cardName: string,
  ): void {
    if (isLegalInFormat(legalities, format)) return;
    throw new BadRequestException(`${cardName} is not legal in ${format}`);
  }

  private assertColorIdentity(
    cardIdentity: string[] | null,
    allowed: ColorIdentityPip[],
    cardName: string,
  ): void {
    if (isColorIdentitySubset(parseColorIdentity(cardIdentity), allowed)) return;
    throw new BadRequestException(`${cardName} is outside this deck's color identity`);
  }

  private async toDeckWithColorIdentity(row: DeckRow): Promise<Deck> {
    const colorByDeck = await this.colorIdentityByDeck([row.id]);
    return toDeck(row, this.logger, colorByDeck.get(row.id) ?? []);
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
    commanderPrintingId: row.commanderPrintingId,
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
  faces: parseCardFaces(row.faces),
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
