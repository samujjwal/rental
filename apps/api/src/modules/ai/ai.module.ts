import { Global, Module } from '@nestjs/common';
import { AiService } from './services/ai.service';
import { EmbeddingService } from './services/embedding.service';
import { AiController } from './ai.controller';
import { EMBEDDING_SERVICE } from '@/common/interfaces/embedding.interface';

@Global()
@Module({
  controllers: [AiController],
  providers: [
    AiService,
    EmbeddingService,
    {
      provide: EMBEDDING_SERVICE,
      useExisting: EmbeddingService,
    },
  ],
  exports: [AiService, EmbeddingService, EMBEDDING_SERVICE],
})
export class AiModule {}
