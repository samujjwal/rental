/**
 * Dead Letter Queue (DLQ) Module
 * 
 * Provides DLQ management functionality for admin operations.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DLQController } from './dlq.controller';
import { DLQService } from './dlq.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'webhooks' },
      { name: 'notifications' },
      { name: 'emails' },
      { name: 'payouts' },
    ),
  ],
  controllers: [DLQController],
  providers: [DLQService],
  exports: [DLQService],
})
export class DLQModule {}
