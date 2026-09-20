import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [CardsModule],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
