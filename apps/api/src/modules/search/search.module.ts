import { Module } from '@nestjs/common';
import { SearchService } from './services/search.service';
import { RecommendationService } from './services/recommendation.service';
import { SearchController } from './controllers/search.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [SearchController],
  providers: [SearchService, RecommendationService],
  exports: [SearchService],
})
export class SearchModule {}
