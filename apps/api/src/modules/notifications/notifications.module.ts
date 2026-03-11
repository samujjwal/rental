import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { InAppNotificationController } from './controllers/inapp-notification.controller';
import { EmailService } from './services/resend.service';
import { SmsService } from './services/twilio.service';
import { InAppNotificationService } from './services/notification.service';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [NotificationsController, AdminNotificationsController, InAppNotificationController],
  providers: [
    NotificationsService,
    EmailService,
    SmsService,
    InAppNotificationService,
    PushNotificationService,
    NotificationPreferencesService,
    EventEmitter2,
  ],
  exports: [NotificationsService, EmailService, SmsService, InAppNotificationService, PushNotificationService],
})
export class NotificationsModule {}
