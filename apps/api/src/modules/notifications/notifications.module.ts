import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { EmailService } from './services/resend.service';
import { EmailController } from './controllers/email.controller';
import { InAppNotificationService } from './services/notification.service';
import { NotificationController } from './controllers/inapp-notification.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [NotificationsController, EmailController, NotificationController],
  providers: [NotificationsService, EmailService, InAppNotificationService, EventEmitter2],
  exports: [NotificationsService, EmailService, InAppNotificationService],
})
export class NotificationsModule {}
