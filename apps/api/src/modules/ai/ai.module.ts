import { Module } from '@nestjs/common';
import { AiService } from './services/ai.service';
import { EmbeddingService } from './services/embedding.service';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [AiService, EmbeddingService],
  exports: [AiService, EmbeddingService],
})
export class AiModule {}
