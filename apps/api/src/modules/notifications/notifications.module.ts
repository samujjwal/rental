import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { EmailService } from './services/resend.service';
import { EmailController } from './controllers/email.controller';
import { InAppNotificationService } from './services/notification.service';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [NotificationsController, EmailController],
  providers: [
    NotificationsService,
    EmailService,
    InAppNotificationService,
    PushNotificationService,
    NotificationPreferencesService,
    EventEmitter2,
  ],
  exports: [NotificationsService, EmailService, InAppNotificationService, PushNotificationService],
})
export class NotificationsModule {}
