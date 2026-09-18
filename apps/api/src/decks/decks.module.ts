import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { DecksController } from './decks.controller'
import { DecksService } from './decks.service'

@Module({
  imports: [UsersModule],
  controllers: [DecksController],
  providers: [DecksService],
})
export class DecksModule {}
