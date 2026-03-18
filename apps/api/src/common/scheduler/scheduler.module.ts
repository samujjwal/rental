import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { LockingModule } from '@/common/locking/locking.module';

@Module({
  imports: [LockingModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
