import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService, CreateConversationDto } from '../services/conversations.service';
import { MessagesService } from '../services/messages.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';

@ApiTags('messaging')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or get conversation' })
  async createConversation(@CurrentUser('id') userId: string, @Body() dto: CreateConversationDto) {
    return this.conversationsService.createOrGetConversation(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user conversations' })
  async getConversations(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.conversationsService.getUserConversations(userId, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
      search,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.conversationsService.getTotalUnreadCount(userId);
    return { count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation details' })
  async getConversation(@Param('id') conversationId: string, @CurrentUser('id') userId: string) {
    return this.conversationsService.getConversation(conversationId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete conversation' })
  async deleteConversation(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.conversationsService.deleteConversation(conversationId, userId);
    return { message: 'Conversation deleted successfully' };
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get conversation messages' })
  async getMessages(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.messagesService.getConversationMessages(conversationId, userId, {
      page: page ? parseInt(page.toString()) : undefined,
      limit: limit ? parseInt(limit.toString()) : undefined,
      before: before ? new Date(before) : undefined,
    });
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  async markConversationAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    const count = await this.messagesService.markConversationAsRead(conversationId, userId);
    return { marked: count };
  }

  @Delete('messages/:messageId')
  @ApiOperation({ summary: 'Delete message' })
  async deleteMessage(@Param('messageId') messageId: string, @CurrentUser('id') userId: string) {
    await this.messagesService.deleteMessage(messageId, userId);
    return { message: 'Message deleted successfully' };
  }
}
