import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import {
  CHAT_CONVERSATION_LIST_DEFAULT_LIMIT,
  chatConversationListQuerySchema,
  type ChatConversationListQuery,
} from '@respark/schemas/chat';
import { uuidSchema } from '@respark/schemas/primitives';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { zodPipe } from '../lib/zod-pipe';

import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  async list(
    @CurrentUserId() userId: string,
    @Query(zodPipe(chatConversationListQuerySchema)) query: ChatConversationListQuery,
  ) {
    return {
      conversations: await this.chat.listConversations(
        userId,
        query.limit ?? CHAT_CONVERSATION_LIST_DEFAULT_LIMIT,
      ),
    };
  }

  @Get('conversations/latest')
  async latest(@CurrentUserId() userId: string) {
    return { conversation: await this.chat.getLatest(userId) };
  }

  @Get('conversations/:id')
  async get(@CurrentUserId() userId: string, @Param('id', zodPipe(uuidSchema)) id: string) {
    return { conversation: await this.chat.getConversationForUser(userId, id) };
  }
}
