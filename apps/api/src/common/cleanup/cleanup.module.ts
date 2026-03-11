import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CleanupProcessor } from './cleanup.processor';
import { EventsModule } from '@/common/events/events.module';

@Module({
  imports: [
    EventsModule,
    BullModule.registerQueue({ name: 'cleanup' }),
  ],
  providers: [CleanupProcessor],
  exports: [CleanupProcessor],
})
export class CleanupModule {}
