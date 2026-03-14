import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AiModule } from '@/modules/ai/ai.module';
import { LockingModule } from '@/common/locking/locking.module';

@Module({
  imports: [AiModule, LockingModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
