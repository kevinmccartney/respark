import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  goodstuffTagSchema,
  type CreateRecommendationGoodstuffBody,
  type GoodstuffTag,
  type RecommendationGoodstuff,
} from '@respark/schemas/recommendations';

import { CardsService } from '../cards/cards.service';
import { DATABASE, type Database } from '../db/database.module';
import { cards, recommendationGoodstuffTags, recommendationGoodstuffs } from '../db/schema';

export type GoodstuffPromptLine = {
  name: string;
  tags: GoodstuffTag[];
};

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly cardsService: CardsService,
    @InjectPinoLogger(RecommendationsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async list(): Promise<RecommendationGoodstuff[]> {
    const rows = await this.db
      .select({
        cardId: recommendationGoodstuffs.cardId,
        note: recommendationGoodstuffs.note,
        createdAt: recommendationGoodstuffs.createdAt,
        name: cards.name,
      })
      .from(recommendationGoodstuffs)
      .innerJoin(cards, eq(cards.id, recommendationGoodstuffs.cardId))
      .orderBy(asc(cards.name));

    const tagsByCard = await this.tagsForCardIds(rows.map((row) => row.cardId));
    return rows
      .map((row) => toGoodstuff(row, tagsByCard.get(row.cardId) ?? []))
      .filter((row) => row.tags.length > 0);
  }

  async listForPrompt(cap: number): Promise<GoodstuffPromptLine[]> {
    const rows = await this.list();
    return rows.slice(0, cap).map((row) => ({ name: row.name, tags: row.tags }));
  }

  async create(body: CreateRecommendationGoodstuffBody): Promise<RecommendationGoodstuff> {
    const card = body.cardId
      ? await this.cardsService.getById(body.cardId)
      : await this.requireExactName(body.name ?? '');
    const tags = [...new Set(body.tags)];

    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(recommendationGoodstuffs).values({
          cardId: card.id,
          note: body.note ?? null,
        });
        await tx.insert(recommendationGoodstuffTags).values(
          tags.map((tag) => ({
            cardId: card.id,
            tag,
          })),
        );
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('That card is already on the goodstuff list');
      }
      throw err;
    }

    this.logger.info(
      { event: 'recommendations.goodstuff.create', cardId: card.id, tags },
      'Added recommendation goodstuff',
    );

    return this.requireRow(card.id);
  }

  async remove(cardId: string): Promise<void> {
    const deleted = await this.db
      .delete(recommendationGoodstuffs)
      .where(eq(recommendationGoodstuffs.cardId, cardId))
      .returning({ cardId: recommendationGoodstuffs.cardId });

    if (deleted.length === 0) {
      throw new NotFoundException('Goodstuff entry not found');
    }

    this.logger.info(
      { event: 'recommendations.goodstuff.delete', cardId },
      'Removed recommendation goodstuff',
    );
  }

  private async requireExactName(name: string): Promise<{ id: string; name: string }> {
    const match = await this.cardsService.findIdByExactName(name);
    if (!match) {
      throw new NotFoundException(`No catalog card named "${name}"`);
    }
    return match;
  }

  private async requireRow(cardId: string): Promise<RecommendationGoodstuff> {
    const rows = await this.db
      .select({
        cardId: recommendationGoodstuffs.cardId,
        note: recommendationGoodstuffs.note,
        createdAt: recommendationGoodstuffs.createdAt,
        name: cards.name,
      })
      .from(recommendationGoodstuffs)
      .innerJoin(cards, eq(cards.id, recommendationGoodstuffs.cardId))
      .where(eq(recommendationGoodstuffs.cardId, cardId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Goodstuff entry not found');
    }
    const tagsByCard = await this.tagsForCardIds([cardId]);
    return toGoodstuff(row, tagsByCard.get(cardId) ?? []);
  }

  private async tagsForCardIds(cardIds: string[]): Promise<Map<string, GoodstuffTag[]>> {
    const out = new Map<string, GoodstuffTag[]>();
    if (cardIds.length === 0) return out;
    const rows = await this.db
      .select({
        cardId: recommendationGoodstuffTags.cardId,
        tag: recommendationGoodstuffTags.tag,
      })
      .from(recommendationGoodstuffTags)
      .where(inArray(recommendationGoodstuffTags.cardId, cardIds))
      .orderBy(asc(recommendationGoodstuffTags.tag));

    for (const row of rows) {
      const parsed = goodstuffTagSchema.safeParse(row.tag);
      if (!parsed.success) continue;
      const existing = out.get(row.cardId) ?? [];
      existing.push(parsed.data);
      out.set(row.cardId, existing);
    }
    return out;
  }
}

const toGoodstuff = (
  row: {
    cardId: string;
    name: string;
    note: string | null;
    createdAt: Date;
  },
  tags: GoodstuffTag[],
): RecommendationGoodstuff => ({
  cardId: row.cardId,
  name: row.name,
  tags,
  note: row.note,
  createdAt: row.createdAt.toISOString(),
});

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: string }).code === '23505';
