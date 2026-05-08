/**
 * AI Override Module
 * 
 * Provides AI-powered suggestion and override functionality for admin operations.
 */

import { Module } from '@nestjs/common';
import { AIOverrideController } from './ai-override.controller';
import { AIOverrideService } from './ai-override.service';

@Module({
  controllers: [AIOverrideController],
  providers: [AIOverrideService],
  exports: [AIOverrideService],
})
export class AIOverrideModule {}
