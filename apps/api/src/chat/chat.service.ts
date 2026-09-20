import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import {
  chatConversationSchema,
  chatPartSchema,
  type ChatConversation,
  type ChatPart,
  type ChatVisibleMessage,
} from 'schemas/chat';
import { CardsService } from '../cards/cards.service';
import { DATABASE, type Database } from '../db/database.module';
import { chatConversations, chatMessages } from '../db/schema';
import { DecksService } from '../decks/decks.service';
import { UsersService } from '../users/users.service';
import { collectLinkableFromToolMessage, type LinkableCard } from './card-links';
import { selectHistoryMessages } from './history';
import { stickyUnchanged } from './sticky-context';

@Injectable()
export class ChatService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly decks: DecksService,
    private readonly cards: CardsService,
    private readonly users: UsersService,
  ) {}

  async requireOwnedDeck(clerkUserId: string, deckId: string) {
    return this.decks.getForUser(clerkUserId, deckId);
  }

  async requireCatalogCard(cardId: string) {
    return this.cards.getById(cardId);
  }

  /**
   * Sticky ids: `undefined` keeps stored (or null on create), `null` clears, uuid sets.
   */
  async loadOrCreateConversation(
    clerkUserId: string,
    conversationId: string | undefined,
    sticky: { deckId?: string | null; cardId?: string | null },
  ) {
    const userId = await this.users.resolveLocalId(clerkUserId);
    if (conversationId) {
      const [row] = await this.db
        .select()
        .from(chatConversations)
        .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
        .limit(1);
      if (!row) throw new NotFoundException('Conversation not found');
      const deckUnchanged = stickyUnchanged(row.deckId ?? null, sticky.deckId);
      const cardUnchanged = stickyUnchanged(row.cardId ?? null, sticky.cardId);
      if (deckUnchanged && cardUnchanged) return row;
      const [updated] = await this.db
        .update(chatConversations)
        .set({
          ...(deckUnchanged ? {} : { deckId: sticky.deckId ?? null }),
          ...(cardUnchanged ? {} : { cardId: sticky.cardId ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(chatConversations.id, row.id))
        .returning();
      return updated ?? row;
    }
    const [created] = await this.db
      .insert(chatConversations)
      .values({
        userId,
        deckId: sticky.deckId ?? null,
        cardId: sticky.cardId ?? null,
      })
      .returning();
    return created;
  }

  async setStickyDeck(conversationId: string, deckId: string | null) {
    await this.db
      .update(chatConversations)
      .set({ deckId, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
  }

  async setStickyCard(conversationId: string, cardId: string | null) {
    await this.db
      .update(chatConversations)
      .set({ cardId, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
  }

  async getConversationForUser(
    clerkUserId: string,
    conversationId: string,
  ): Promise<ChatConversation> {
    const userId = await this.users.resolveLocalId(clerkUserId);
    const [row] = await this.db
      .select()
      .from(chatConversations)
      .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException('Conversation not found');
    return this.toConversation(row);
  }

  async getLatest(clerkUserId: string): Promise<ChatConversation | null> {
    const userId = await this.users.resolveLocalId(clerkUserId);
    const [row] = await this.db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt))
      .limit(1);
    if (!row) return null;
    return this.toConversation(row);
  }

  async loadHistory(conversationId: string) {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);
    return selectHistoryMessages(rows);
  }

  async loadLinkableCards(conversationId: string): Promise<LinkableCard[]> {
    const rows = await this.db
      .select({
        toolName: chatMessages.toolName,
        parts: chatMessages.parts,
      })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.role, 'tool')))
      .orderBy(chatMessages.createdAt);
    const into: LinkableCard[] = [];
    for (const row of rows) {
      collectLinkableFromToolMessage(row.toolName, parseParts(row.parts), into);
    }
    return into;
  }

  async appendUserMessage(conversationId: string, text: string) {
    return this.appendMessage(conversationId, 'user', [{ type: 'text', text }]);
  }

  async appendAssistantMessage(conversationId: string, parts: ChatPart[]) {
    return this.appendMessage(conversationId, 'assistant', parts);
  }

  async appendToolMessage(
    conversationId: string,
    toolName: string,
    toolCallId: string,
    args: unknown,
    result: unknown,
  ) {
    return this.appendMessage(
      conversationId,
      'tool',
      [{ type: 'text', text: JSON.stringify({ args, result }) }],
      toolName,
      toolCallId,
    );
  }

  private async appendMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'tool',
    parts: ChatPart[],
    toolName?: string,
    toolCallId?: string,
  ) {
    const [row] = await this.db
      .insert(chatMessages)
      .values({
        conversationId,
        role,
        parts,
        toolName: toolName ?? null,
        toolCallId: toolCallId ?? null,
      })
      .returning({
        id: chatMessages.id,
        parts: chatMessages.parts,
        createdAt: chatMessages.createdAt,
      });
    await this.db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
    return { id: row.id, parts: parseParts(row.parts), createdAt: row.createdAt };
  }

  private async toConversation(
    row: typeof chatConversations.$inferSelect,
  ): Promise<ChatConversation> {
    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, row.id))
      .orderBy(chatMessages.createdAt);
    const visible: ChatVisibleMessage[] = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        id: message.id,
        role: message.role as 'user' | 'assistant',
        parts: parseParts(message.parts),
        createdAt: message.createdAt.toISOString(),
      }));
    return chatConversationSchema.parse({
      id: row.id,
      deckId: row.deckId,
      cardId: row.cardId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: visible,
    });
  }
}

const parseParts = (raw: ChatPart[]): ChatPart[] => {
  const parsed = chatPartSchema.array().safeParse(raw);
  return parsed.success ? parsed.data : [];
};
