import { Module } from '@nestjs/common';
import { ContentModerationService } from './services/content-moderation.service';
import { ImageModerationService } from './services/image-moderation.service';
import { TextModerationService } from './services/text-moderation.service';
import { ModerationQueueService } from './services/moderation-queue.service';
import { ModerationController } from './controllers/moderation.controller';

@Module({
  controllers: [ModerationController],
  providers: [
    ContentModerationService,
    ImageModerationService,
    TextModerationService,
    ModerationQueueService,
  ],
  exports: [ContentModerationService],
})
export class ModerationModule {}
