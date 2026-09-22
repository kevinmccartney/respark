import type { Column } from 'drizzle-orm';
import type { ColumnBuilderExtraConfig } from 'drizzle-orm/column-builder';
import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import type { ChatPart } from '@respark/schemas/chat';

import { cards } from './catalog/tables';
import { decks } from './decks';
import { appSchema } from './pipeline-schemas';
import { users } from './users';

type _DrizzlePortableColumn = Column;
type _DrizzlePortableColumnBuilder = ColumnBuilderExtraConfig;
export type { _DrizzlePortableColumn as _ChatPortableColumn };
export type { _DrizzlePortableColumnBuilder as _ChatPortableColumnBuilder };

export const chatConversations = appSchema.table(
  'chat_conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chat_conversation_user_id_deck_id_idx').on(table.userId, table.deckId),
    index('chat_conversation_user_id_card_id_idx').on(table.userId, table.cardId),
    index('chat_conversation_user_id_updated_at_idx').on(table.userId, table.updatedAt),
  ],
);

export type ChatConversationRow = typeof chatConversations.$inferSelect;

export const chatMessages = appSchema.table(
  'chat_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    parts: jsonb('parts').notNull().$type<ChatPart[]>(),
    toolName: text('tool_name'),
    toolCallId: text('tool_call_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chat_message_conversation_id_created_at_idx').on(table.conversationId, table.createdAt),
  ],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;
