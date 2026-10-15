import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  countDeckChanges,
  deckSnapshotFromDetail,
  diffDeck,
  EMPTY_DECK_CHANGES,
  snapshotWithDetails,
  type DeckRevision,
  type DeckRevisionsPage,
  type DeckSavedState,
} from '@respark/schemas/deck-revisions';
import type { DeckDetail } from '@respark/schemas/decks';

import { DATABASE, type Database } from '../db/database.module';
import { deckCards, deckRevisions, decks, type DeckRevisionRow } from '../db/schema';

import { DecksService } from './decks.service';

const toRevision = (row: DeckRevisionRow): DeckRevision => ({
  id: row.id,
  createdAt: row.createdAt.toISOString(),
  note: row.note,
  changes: row.changes,
});

@Injectable()
export class DeckRevisionsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly decks: DecksService,
    @InjectPinoLogger(DeckRevisionsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getSavedState(clerkUserId: string, deckId: string): Promise<DeckSavedState> {
    await this.decks.getForUser(clerkUserId, deckId);
    const latest = await this.latest(this.db, deckId);
    return {
      revisionId: latest?.id ?? null,
      savedAt: latest?.createdAt.toISOString() ?? null,
      snapshot: latest?.snapshot ?? null,
    };
  }

  async list(
    clerkUserId: string,
    deckId: string,
    { page, limit }: { page: number; limit: number },
  ): Promise<DeckRevisionsPage> {
    await this.decks.getForUser(clerkUserId, deckId);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId));
    const rows = await this.db
      .select()
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId))
      .orderBy(desc(deckRevisions.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      revisions: rows.map(toRevision),
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async save(clerkUserId: string, deckId: string, note: string | undefined): Promise<DeckRevision> {
    const snapshot = deckSnapshotFromDetail(await this.decks.getForUser(clerkUserId, deckId));

    const row = await this.db.transaction(async (tx) => {
      // Serializes saves on one deck, so a double-click can't record the same diff twice.
      await tx.select({ id: decks.id }).from(decks).where(eq(decks.id, deckId)).for('update');
      const latest = await this.latest(tx, deckId);
      const changes = diffDeck(latest?.snapshot ?? null, snapshot);
      if (countDeckChanges(changes) === 0) {
        throw new ConflictException('No changes to save');
      }
      const [created] = await tx
        .insert(deckRevisions)
        .values({ deckId, note: note || null, snapshot, changes })
        .returning();
      return created;
    });

    this.logger.info(
      {
        event: 'decks.save',
        userId: clerkUserId,
        deckId,
        revisionId: row.id,
        cardChanges: row.changes.cards.length,
        detailChanges: row.changes.details.length,
      },
      'Saved deck revision',
    );
    return toRevision(row);
  }

  /** Saves deck detail edits straight away with a generated note; card edits stay unsaved. */
  async saveDetails(clerkUserId: string, deckId: string): Promise<void> {
    const current = deckSnapshotFromDetail(await this.decks.getForUser(clerkUserId, deckId));

    const row = await this.db.transaction(async (tx) => {
      await tx.select({ id: decks.id }).from(decks).where(eq(decks.id, deckId)).for('update');
      const latest = await this.latest(tx, deckId);
      const snapshot = latest ? snapshotWithDetails(latest.snapshot, current) : current;
      const changes = diffDeck(latest?.snapshot ?? null, snapshot);
      if (changes.details.length === 0) return null;
      const note = `Details updated: ${changes.details.map((change) => change.field).join(', ')}`;
      const [created] = await tx
        .insert(deckRevisions)
        .values({ deckId, note, snapshot, changes })
        .returning();
      return created;
    });
    if (!row) return;

    this.logger.info(
      {
        event: 'decks.save_details',
        userId: clerkUserId,
        deckId,
        revisionId: row.id,
        fields: row.changes.details.map((change) => change.field),
      },
      'Saved deck details revision',
    );
  }

  /** Puts the working copy back to the last saved snapshot. */
  async discard(clerkUserId: string, deckId: string): Promise<DeckDetail> {
    await this.decks.getForUser(clerkUserId, deckId);

    await this.db.transaction(async (tx) => {
      await tx.select({ id: decks.id }).from(decks).where(eq(decks.id, deckId)).for('update');
      const latest = await this.latest(tx, deckId);
      if (!latest) {
        throw new ConflictException('This deck has never been saved');
      }
      const { snapshot } = latest;

      await tx.delete(deckCards).where(eq(deckCards.deckId, deckId));
      await tx
        .update(decks)
        .set({
          name: snapshot.name,
          description: snapshot.description,
          format: snapshot.format,
          commanderPrintingId: snapshot.commander?.printingId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(decks.id, deckId));
      if (snapshot.cards.length > 0) {
        await tx.insert(deckCards).values(
          snapshot.cards.map((card) => ({
            deckId,
            printingId: card.printingId,
            foil: card.foil,
            sideboard: card.sideboard,
            quantity: card.quantity,
          })),
        );
      }
    });

    this.logger.info({ event: 'decks.discard', userId: clerkUserId, deckId }, 'Discarded changes');
    return this.decks.getForUser(clerkUserId, deckId);
  }

  /** Records the starting point for a new deck so its first save only lists real changes. */
  async recordBaseline(clerkUserId: string, deckId: string): Promise<void> {
    const snapshot = deckSnapshotFromDetail(await this.decks.getForUser(clerkUserId, deckId));
    await this.db.insert(deckRevisions).values({
      deckId,
      note: 'Created deck',
      snapshot,
      changes: EMPTY_DECK_CHANGES,
    });
  }

  private async latest(
    db: Pick<Database, 'select'>,
    deckId: string,
  ): Promise<DeckRevisionRow | undefined> {
    const [row] = await db
      .select()
      .from(deckRevisions)
      .where(eq(deckRevisions.deckId, deckId))
      .orderBy(desc(deckRevisions.createdAt))
      .limit(1);
    return row;
  }
}
