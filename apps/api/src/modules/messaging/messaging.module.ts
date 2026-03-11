import { Module } from '@nestjs/common';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { MessagingGateway } from './gateways/messaging.gateway';
import { MessagingController } from './controllers/messaging.controller';
import { AuthModule } from '../auth/auth.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [AuthModule, ModerationModule, NotificationsModule],
  controllers: [MessagingController],
  providers: [ConversationsService, MessagesService, MessagingGateway],
  exports: [ConversationsService, MessagesService, MessagingGateway],
})
export class MessagingModule {}
