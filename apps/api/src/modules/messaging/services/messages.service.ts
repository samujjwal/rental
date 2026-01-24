import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { Message, Prisma } from '@prisma/client';

export interface SendMessageDto {
  conversationId: string;
  content: string;
  attachments?: string[];
}

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

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
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
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
            profile: true,
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
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    const where: Prisma.MessageWhereInput = {
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
              profile: true,
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
      throw new NotFoundException('Message not found');
    }

    // Verify user is participant (but not sender)
    const isParticipant = message.conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant || message.senderId === userId) {
      throw new ForbiddenException('Cannot mark this message as read');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
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
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only sender can delete
    if (message.senderId !== userId) {
      throw new ForbiddenException('Can only delete your own messages');
    }

    // Soft delete - just mark as deleted
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: '[Message deleted]',
        attachments: [],
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
            profile: true,
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
      throw new NotFoundException('Message not found');
    }

    // Verify user is participant
    const isParticipant = message.conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    return message;
  }
}
