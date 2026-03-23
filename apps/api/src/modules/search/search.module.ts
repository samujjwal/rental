import { Module } from '@nestjs/common';
import { SearchService } from './services/search.service';
import { RecommendationService } from './services/recommendation.service';
import { SearchRankingService } from './services/search-ranking.service';
import { SearchController } from './controllers/search.controller';
import { AiModule } from '../ai/ai.module';
import { EmbeddingService } from '../ai/services/embedding.service';
import { SEMANTIC_RANKING_PORT } from './ports/semantic-ranking.port';

@Module({
  imports: [AiModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    RecommendationService,
    SearchRankingService,
    // Wire the AI EmbeddingService to the Search domain's SemanticRankingPort.
    // SearchService depends only on the port interface; swapping the adapter
    // requires only a change here, not inside SearchService.
    {
      provide: SEMANTIC_RANKING_PORT,
      useExisting: EmbeddingService,
    },
  ],
  exports: [SearchService, SearchRankingService],
})
export class SearchModule {}
