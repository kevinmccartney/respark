import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import type { DeckChanges, DeckSnapshot } from '@respark/schemas/deck-revisions';

import { decks } from './decks';
import { appSchema } from './pipeline-schemas';

type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _DeckRevisionsPortableColumn };
export type { _DrizzlePortableColumnBuilder as _DeckRevisionsPortableColumnBuilder };

/** A saved version of a deck: the full state at save time plus the diff from the previous save. */
export const deckRevisions = appSchema.table(
  'deck_revision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    note: text('note'),
    snapshot: jsonb('snapshot').notNull().$type<DeckSnapshot>(),
    changes: jsonb('changes').notNull().$type<DeckChanges>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('deck_revision_deck_id_created_at_idx').on(table.deckId, table.createdAt.desc()),
  ],
);

export type DeckRevisionRow = typeof deckRevisions.$inferSelect;
