import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CleanupProcessor } from './cleanup.processor';
import { EventsModule } from '@/common/events/events.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditArchivalService } from '@/common/audit/audit-archival.service';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    BullModule.registerQueue({ name: 'cleanup' }),
  ],
  providers: [CleanupProcessor, AuditArchivalService],
  exports: [CleanupProcessor],
})
export class CleanupModule {}
