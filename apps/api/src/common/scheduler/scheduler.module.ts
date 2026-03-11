import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { AiModule } from '@/modules/ai/ai.module';

@Module({
  imports: [ScheduleModule.forRoot(), AiModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
