import { Module, forwardRef } from '@nestjs/common';
import { EmailModule } from '@/common/email/email.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { BookingsModule } from '@/modules/bookings/bookings.module';
import { EventsModule } from '@/common/events/events.module';
import { DisputesService } from './services/disputes.service';
import { DisputeEscalationService } from './services/dispute-escalation.service';
import { DisputesController } from './controllers/disputes.controller';
import { DisputeSlaScheduler } from './schedulers/dispute-sla.scheduler';

@Module({
  imports: [EmailModule, NotificationsModule, forwardRef(() => BookingsModule), EventsModule],
  controllers: [DisputesController],
  providers: [DisputesService, DisputeEscalationService, DisputeSlaScheduler],
  exports: [DisputesService, DisputeEscalationService],
})
export class DisputesModule {}
