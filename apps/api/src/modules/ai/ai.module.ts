import { Global, Module } from '@nestjs/common';
import { AiService } from './services/ai.service';
import { EmbeddingService } from './services/embedding.service';
import { MarketInsightsService } from './services/market-insights.service';
import { AiUsageLedgerService } from './services/ai-usage-ledger.service';
import { AiController } from './ai.controller';
import { EMBEDDING_SERVICE } from '@/common/interfaces/embedding.interface';
import { OpenAiProviderAdapter } from './adapters/openai-provider.adapter';
import { AI_PROVIDER_PORT } from './ports/ai-provider.port';
import { AiTelemetryInterceptor } from './interceptors/ai-telemetry.interceptor';

@Global()
@Module({
  controllers: [AiController],
  providers: [
    OpenAiProviderAdapter,
    {
      provide: AI_PROVIDER_PORT,
      useExisting: OpenAiProviderAdapter,
    },
    AiService,
    EmbeddingService,
    MarketInsightsService,
    AiUsageLedgerService,
    AiTelemetryInterceptor,
    {
      provide: EMBEDDING_SERVICE,
      useExisting: EmbeddingService,
    },
  ],
  exports: [AiService, EmbeddingService, MarketInsightsService, AiUsageLedgerService, EMBEDDING_SERVICE, AI_PROVIDER_PORT],
})
export class AiModule {}
