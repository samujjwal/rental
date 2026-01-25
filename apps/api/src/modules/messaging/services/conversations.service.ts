import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Conversation, Message, Prisma } from '@rental-portal/database';

export interface CreateConversationDto {
  listingId: string;
  participantId: string;
}

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create or get existing conversation
   */
  async createOrGetConversation(userId: string, dto: CreateConversationDto): Promise<Conversation> {
    const { listingId, participantId } = dto;

    // Verify listing exists
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Check if conversation already exists
    const existing = await this.prisma.conversation.findFirst({
      where: {
        listingId,
        OR: [
          {
            AND: [
              { participants: { some: { userId } } },
              { participants: { some: { userId: participantId } } },
            ],
          },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                readReceipts: {
                  none: { userId },
                },
                senderId: { not: userId },
              },
            },
          },
        },
      },
    });

    if (existing) {
      return existing as any;
    }

    // Create new conversation
    const conversation = await this.prisma.conversation.create({
      data: {
        listingId,
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return conversation as any;
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
    } = {},
  ): Promise<{ conversations: any[]; total: number }> {
    const { page = 1, limit = 20, search } = options;

    const where: Prisma.ConversationWhereInput = {
      participants: {
        some: {
          userId,
        },
      },
    };

    // Add search filter
    if (search) {
      where.OR = [
        {
          participants: {
            some: {
              user: {
                firstName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
        },
      ];
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  profilePhotoUrl: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              messages: {
                where: {
                  readReceipts: {
                    none: { userId },
                  },
                  senderId: { not: userId },
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Format conversations with unread count
    const formattedConversations = conversations.map((conv) => ({
      ...conv,
      unreadCount: (conv._count as any).messages,
      lastMessage: conv.messages[0] || null,
      messages: undefined,
      _count: undefined,
    }));

    return {
      conversations: formattedConversations,
      total,
    };
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<any> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                readReceipts: {
                  none: { userId },
                },
                senderId: { not: userId },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    return {
      ...conversation,
      unreadCount: (conversation._count as any).messages,
      _count: undefined,
    };
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });
  }

  /**
   * Get total unread count for user
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        _count: {
          select: {
            messages: {
              where: {
                readReceipts: {
                  none: { userId },
                },
                senderId: { not: userId },
              },
            },
          },
        },
      },
    });

    return conversations.reduce((total, conv) => total + (conv._count as any).messages, 0);
  }

  /**
   * Check if user can message in conversation
   */
  async canUserMessage(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return false;
    }

    return conversation.participants.some((p) => p.userId === userId);
  }
}
