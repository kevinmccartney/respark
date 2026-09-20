import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { printings } from './catalog/tables';
import { appSchema } from './pipeline-schemas';
import { users } from './users';

// Keep these in scope so `declaration: true` can name inferred table types.
type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _DecksPortableColumn };
export type { _DrizzlePortableColumnBuilder as _DecksPortableColumnBuilder };

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
    commanderPrintingId: uuid('commander_printing_id').references(() => printings.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('decks_user_id_updated_at_idx').on(table.userId, table.updatedAt),
    check(
      'decks_commander_matches_format_chk',
      sql`(
        (${table.format} = 'commander' AND ${table.commanderPrintingId} IS NOT NULL)
        OR (${table.format} <> 'commander' AND ${table.commanderPrintingId} IS NULL)
      )`,
    ),
  ],
);

export type DeckRow = typeof decks.$inferSelect;
