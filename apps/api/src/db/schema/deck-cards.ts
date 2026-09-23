import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { boolean, index, integer, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { printings } from './catalog/tables';
import { decks } from './decks';
import { appSchema } from './pipeline-schemas';

type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _DeckCardsPortableColumn };
export type { _DrizzlePortableColumnBuilder as _DeckCardsPortableColumnBuilder };

/** A unique printing line in a deck (printing + foil + main/sideboard). */
export const deckCards = appSchema.table(
  'deck_card',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    printingId: uuid('printing_id')
      .notNull()
      .references(() => printings.id, { onDelete: 'restrict' }),
    foil: boolean('foil').notNull().default(false),
    sideboard: boolean('sideboard').notNull().default(false),
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('deck_card_deck_printing_foil_sb_uidx').on(
      table.deckId,
      table.printingId,
      table.foil,
      table.sideboard,
    ),
    index('deck_card_deck_id_idx').on(table.deckId),
  ],
);

export type DeckCardRow = typeof deckCards.$inferSelect;
