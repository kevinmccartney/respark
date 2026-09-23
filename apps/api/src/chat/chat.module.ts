import { Module } from '@nestjs/common';

import { CardsModule } from '../cards/cards.module';
import { DecksModule } from '../decks/decks.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { UsersModule } from '../users/users.module';

import { CHAT_PROVIDER_TOKEN, SPELLBOOK_CLIENT } from './chat.constants';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatOrchestrator } from './orchestrator';
import { BedrockChatProvider } from './provider/bedrock.provider';
import type { ChatProvider } from './provider/chat-provider';
import { MockChatProvider } from './provider/mock.provider';
import { createSpellbookClient } from './spellbook/client';

const resolveChatProvider = (
  bedrock: BedrockChatProvider,
  mock: MockChatProvider,
): ChatProvider => {
  const name = (process.env.CHAT_PROVIDER ?? 'bedrock').toLowerCase();
  return name === 'mock' ? mock : bedrock;
};

@Module({
  imports: [DecksModule, CardsModule, RecommendationsModule, UsersModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatOrchestrator,
    ChatGateway,
    BedrockChatProvider,
    MockChatProvider,
    {
      provide: CHAT_PROVIDER_TOKEN,
      useFactory: resolveChatProvider,
      inject: [BedrockChatProvider, MockChatProvider],
    },
    {
      provide: SPELLBOOK_CLIENT,
      useFactory: createSpellbookClient,
    },
  ],
})
export class ChatModule {}
