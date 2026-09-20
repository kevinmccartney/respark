import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  recommendationDownweightKindSchema,
  type CreateRecommendationDownweightBody,
  type RecommendationDownweight,
  type RecommendationDownweightKind,
} from 'schemas/recommendations';
import { CardsService } from '../cards/cards.service';
import { DATABASE, type Database } from '../db/database.module';
import { cards, recommendationDownweights } from '../db/schema';

export type DownweightPromptLine = {
  name: string;
  kind: RecommendationDownweightKind;
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

  async list(): Promise<RecommendationDownweight[]> {
    const rows = await this.db
      .select({
        cardId: recommendationDownweights.cardId,
        kind: recommendationDownweights.kind,
        note: recommendationDownweights.note,
        createdAt: recommendationDownweights.createdAt,
        name: cards.name,
      })
      .from(recommendationDownweights)
      .innerJoin(cards, eq(cards.id, recommendationDownweights.cardId))
      .orderBy(asc(recommendationDownweights.kind), asc(cards.name));

    return rows.map(toDownweight);
  }

  async listForPrompt(cap: number): Promise<DownweightPromptLine[]> {
    const rows = await this.list();
    return rows.slice(0, cap).map((row) => ({ name: row.name, kind: row.kind }));
  }

  async create(body: CreateRecommendationDownweightBody): Promise<RecommendationDownweight> {
    const card = body.cardId
      ? await this.cardsService.getById(body.cardId)
      : await this.requireExactName(body.name ?? '');

    try {
      await this.db.insert(recommendationDownweights).values({
        cardId: card.id,
        kind: body.kind,
        note: body.note ?? null,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('That card is already on the downweight list');
      }
      throw err;
    }

    this.logger.info(
      { event: 'recommendations.downweight.create', cardId: card.id, kind: body.kind },
      'Added recommendation downweight',
    );

    return this.requireRow(card.id);
  }

  async remove(cardId: string): Promise<void> {
    const deleted = await this.db
      .delete(recommendationDownweights)
      .where(eq(recommendationDownweights.cardId, cardId))
      .returning({ cardId: recommendationDownweights.cardId });

    if (deleted.length === 0) {
      throw new NotFoundException('Downweight not found');
    }

    this.logger.info(
      { event: 'recommendations.downweight.delete', cardId },
      'Removed recommendation downweight',
    );
  }

  private async requireExactName(name: string): Promise<{ id: string; name: string }> {
    const match = await this.cardsService.findIdByExactName(name);
    if (!match) {
      throw new NotFoundException(`No catalog card named "${name}"`);
    }
    return match;
  }

  private async requireRow(cardId: string): Promise<RecommendationDownweight> {
    const rows = await this.db
      .select({
        cardId: recommendationDownweights.cardId,
        kind: recommendationDownweights.kind,
        note: recommendationDownweights.note,
        createdAt: recommendationDownweights.createdAt,
        name: cards.name,
      })
      .from(recommendationDownweights)
      .innerJoin(cards, eq(cards.id, recommendationDownweights.cardId))
      .where(eq(recommendationDownweights.cardId, cardId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Downweight not found');
    }
    return toDownweight(row);
  }
}

const toDownweight = (row: {
  cardId: string;
  name: string;
  kind: string;
  note: string | null;
  createdAt: Date;
}): RecommendationDownweight => ({
  cardId: row.cardId,
  name: row.name,
  kind: recommendationDownweightKindSchema.parse(row.kind),
  note: row.note,
  createdAt: row.createdAt.toISOString(),
});

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: string }).code === '23505';
