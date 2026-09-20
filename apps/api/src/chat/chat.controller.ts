import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { uuidSchema } from 'schemas/primitives';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { zodPipe } from '../lib/zod-pipe';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  async latest(@CurrentUserId() userId: string) {
    return { conversation: await this.chat.getLatest(userId) };
  }

  @Get('conversations/:id')
  async get(@CurrentUserId() userId: string, @Param('id', zodPipe(uuidSchema)) id: string) {
    return { conversation: await this.chat.getConversationForUser(userId, id) };
  }
}
