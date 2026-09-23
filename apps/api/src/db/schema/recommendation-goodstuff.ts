import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { cards } from './catalog/tables';
import { appSchema } from './pipeline-schemas';

type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _RecommendationGoodstuffPortableColumn };
export type { _DrizzlePortableColumnBuilder as _RecommendationGoodstuffPortableColumnBuilder };

/**
 * Admin policy list of format goodstuff. Soft flag for chat recommendations —
 * not a catalog fact and not a search ban. Tags live on recommendation_goodstuff_tag.
 */
export const recommendationGoodstuffs = appSchema.table('recommendation_goodstuff', {
  cardId: uuid('card_id')
    .primaryKey()
    .references(() => cards.id, { onDelete: 'cascade' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recommendationGoodstuffTags = appSchema.table(
  'recommendation_goodstuff_tag',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => recommendationGoodstuffs.cardId, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.tag] })],
);

export type RecommendationGoodstuffRow = typeof recommendationGoodstuffs.$inferSelect;
export type RecommendationGoodstuffTagRow = typeof recommendationGoodstuffTags.$inferSelect;
