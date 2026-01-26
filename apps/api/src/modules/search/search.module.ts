import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchService } from './services/search.service';
import { SearchIndexService } from './services/search-index.service';
import { SearchController } from './controllers/search.controller';

@Module({
  imports: [ElasticsearchModule],
  controllers: [SearchController],
  providers: [SearchService, SearchIndexService],
  exports: [SearchService, SearchIndexService],
})
export class SearchModule {}
