import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { CacheModule } from '@/common/cache/cache.module';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { SearchAnalyticsController } from './controllers/search-analytics.controller';
import { SearchAnalyticsService } from './services/search-analytics.service';
import { SearchRepository } from './repositories/search.repository';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [AnalyticsController, SearchAnalyticsController],
  providers: [AnalyticsService, SearchAnalyticsService, SearchRepository],
  exports: [AnalyticsService, SearchAnalyticsService, SearchRepository],
})
export class AnalyticsModule {}
