import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cards } from './catalog/tables';
import { appSchema } from './pipeline-schemas';

type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _RecommendationDownweightPortableColumn };
export type { _DrizzlePortableColumnBuilder as _RecommendationDownweightPortableColumnBuilder };

/**
 * Admin policy list of format staples / tutors / etc. Soft downweight for chat
 * recommendations — not a catalog fact and not a search ban.
 */
export const recommendationDownweights = appSchema.table('recommendation_downweight', {
  cardId: uuid('card_id')
    .primaryKey()
    .references(() => cards.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RecommendationDownweightRow = typeof recommendationDownweights.$inferSelect;
