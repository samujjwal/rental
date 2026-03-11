import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { i18nNotFound,i18nForbidden,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Conversation, Message } from '@rental-portal/database';
import { Prisma } from '@prisma/client';

export interface CreateConversationDto {
  listingId: string;
  participantId: string;
}

/** Participant with user profile */
interface ParticipantWithUser {
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl: string | null;
  };
}

/** Conversation with participants, listing, and computed fields */
export interface ConversationWithDetails {
  id: string;
  listingId: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantWithUser[];
  listing?: { id: string; title: string; photos: string[] } | null;
  unreadCount: number;
  lastMessage: Message | null;
}

/** List result with pagination */
export interface ConversationListResult {
  conversations: ConversationWithDetails[];
  total: number;
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
      throw i18nNotFound('listing.notFound');
    }

    // Verify participant exists
    const participant = await this.prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, status: true },
    });

    if (!participant) {
      throw i18nNotFound('common.notFound');
    }

    if (participant.status === 'DELETED' || participant.status === 'SUSPENDED') {
      throw i18nBadRequest('message.cannotStartConversation');
    }

    // Prevent self-conversation
    if (userId === participantId) {
      throw i18nBadRequest('message.cannotMessageSelf');
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
      return existing as Conversation;
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

    return conversation as Conversation;
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
  ): Promise<ConversationListResult> {
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
          listing: {
            select: {
              id: true,
              title: true,
              photos: true,
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
    const formattedConversations: ConversationWithDetails[] = conversations.map((conv) => ({
      id: conv.id,
      listingId: conv.listingId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      participants: conv.participants as ParticipantWithUser[],
      listing: conv.listing,
      unreadCount: (conv as Record<string, any>)._count?.messages || 0,
      lastMessage: conv.messages?.[0] || null,
    }));

    return {
      conversations: formattedConversations,
      total,
    };
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<ConversationWithDetails> {
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
        listing: {
          select: {
            id: true,
            title: true,
            photos: true,
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
      throw i18nNotFound('message.conversationNotFound');
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw i18nForbidden('message.unauthorized');
    }

    return {
      id: conversation.id,
      listingId: conversation.listingId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants as ParticipantWithUser[],
      listing: conversation.listing,
      unreadCount: (conversation as Record<string, any>)._count?.messages || 0,
      lastMessage: null,
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
      throw i18nNotFound('message.conversationNotFound');
    }

    // Verify user is participant
    const isParticipant = conversation.participants.some((p) => p.userId === userId);

    if (!isParticipant) {
      throw i18nForbidden('message.unauthorized');
    }

    // Soft-delete: remove the requesting user from participants
    // If that was the last participant, delete the conversation
    await this.prisma.conversationParticipant.deleteMany({
      where: {
        conversationId: conversationId,
        userId: userId,
      },
    });

    // If no participants remain, actually delete the conversation
    const remaining = await this.prisma.conversationParticipant.count({
      where: { conversationId },
    });
    if (remaining === 0) {
      await this.prisma.conversation.delete({
        where: { id: conversationId },
      });
    }
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

    return conversations.reduce((total, conv) => total + ((conv as Record<string, any>)._count?.messages || 0), 0);
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
