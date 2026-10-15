import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { DeckRevisionsService } from './deck-revisions.service';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';

@Module({
  imports: [UsersModule],
  controllers: [DecksController],
  providers: [DecksService, DeckRevisionsService],
  exports: [DecksService],
})
export class DecksModule {}
