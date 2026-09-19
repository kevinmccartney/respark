import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appSchema } from './pipeline-schemas';
import { users } from './users';

// Keep these in scope so `declaration: true` can name inferred table types.
type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _DecksPortableColumn };
export type { _DrizzlePortableColumnBuilder as _DecksPortableColumnBuilder };

export const DECK_FORMATS = ['standard', 'commander', 'modern'] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

export const decks = appSchema.table(
  'decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    format: text('format').notNull().default('standard'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('decks_user_id_updated_at_idx').on(table.userId, table.updatedAt)],
);

export type DeckRow = typeof decks.$inferSelect;
