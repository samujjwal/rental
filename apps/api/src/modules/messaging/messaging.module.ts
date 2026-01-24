import { Module } from '@nestjs/common';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { MessagingGateway } from './gateways/messaging.gateway';
import { MessagingController } from './controllers/messaging.controller';

@Module({
  controllers: [MessagingController],
  providers: [ConversationsService, MessagesService, MessagingGateway],
  exports: [ConversationsService, MessagesService, MessagingGateway],
})
export class MessagingModule {}
