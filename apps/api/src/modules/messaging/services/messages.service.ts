import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { i18nNotFound,i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ContentModerationService } from '../../moderation/services/content-moderation.service';
import { Message } from '@rental-portal/database';

export interface SendMessageDto {
  conversationId: string;
  content: string;
  attachments?: string[];
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private moderationService: ContentModerationService,
  ) {}

  /**
   * Send a message
   */
  async sendMessage(userId: string, dto: SendMessageDto): Promise<Message> {
    const { conversationId, content, attachments = [] } = dto;

    // Verify conversation exists and user is participant
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw i18nNotFound('message.conversationNotFound');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw i18nForbidden('message.unauthorized');
    }

    // Moderate message content
    try {
      const modResult = await this.moderationService.moderateMessage(content);
      if (modResult.status === 'REJECTED' || modResult.status === 'FLAGGED') {
        throw new BadRequestException({
          message: 'Message content violates our content policies',
          flags: modResult.flags,
        });
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn('Message moderation check failed, proceeding', error);
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        attachments,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(
    conversationId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      before?: Date;
    } = {},
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 50, before } = options;

    // Verify user is participant
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw i18nNotFound('message.conversationNotFound');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw i18nForbidden('message.unauthorized');
    }

    const where: any = {
      conversationId,
    };

    if (before) {
      where.createdAt = { lt: before };
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit + 1, // Take one extra to check if there are more
      }),
      this.prisma.message.count({ where }),
    ]);

    // Check if there are more messages
    const hasMore = messages.length > limit;
    const returnMessages = hasMore ? messages.slice(0, limit) : messages;

    // Reverse to show oldest first
    returnMessages.reverse();

    return {
      messages: returnMessages,
      total,
      hasMore,
    };
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, userId: string): Promise<Message> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!message) {
      throw i18nNotFound('message.notFound');
    }

    // Verify user is participant (but not sender)
    const isParticipant = message.conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant || message.senderId === userId) {
      throw i18nForbidden('message.unauthorized');
    }

    await this.prisma.messageReadReceipt.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
        readAt: new Date(),
      },
      update: {
        readAt: new Date(),
      },
    });

    return message;
  }

  /**
   * Mark all conversation messages as read
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<number> {
    // Verify user is participant
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw i18nNotFound('message.conversationNotFound');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw i18nForbidden('message.unauthorized');
    }

    const unreadMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readReceipts: {
          none: { userId },
        },
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) {
      return 0;
    }

    const readAt = new Date();
    const payload = unreadMessages.map((m) => ({
      messageId: m.id,
      userId,
      readAt,
    }));

    try {
      const result = await this.prisma.messageReadReceipt.createMany({
        data: payload,
        skipDuplicates: true,
      });

      return result.count;
    } catch {
      // Message rows can disappear between select and insert in concurrent flows.
      // Retry only with currently existing message IDs.
      const existingMessages = await this.prisma.message.findMany({
        where: {
          id: { in: unreadMessages.map((m) => m.id) },
        },
        select: { id: true },
      });

      if (existingMessages.length === 0) {
        return 0;
      }

      const retryResult = await this.prisma.messageReadReceipt.createMany({
        data: existingMessages.map((m) => ({
          messageId: m.id,
          userId,
          readAt,
        })),
        skipDuplicates: true,
      });

      return retryResult.count;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw i18nNotFound('message.notFound');
    }

    // Only sender can delete
    if (message.senderId !== userId) {
      throw i18nForbidden('message.cannotDeleteOthers');
    }

    // Soft delete - mark as deleted and clear content
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: '[Message deleted]',
        attachments: [],
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string, userId: string): Promise<Message> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!message) {
      throw i18nNotFound('message.notFound');
    }

    // Verify user is participant
    const isParticipant = message.conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw i18nForbidden('message.unauthorized');
    }

    return message;
  }
}
