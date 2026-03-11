import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface UserDataExport {
  exportedAt: string;
  profile: Record<string, any>;
  bookings: any[];
  listings: any[];
  reviews: any[];
  messages: any[];
  favorites: any[];
  notifications: any[];
  sessions: any[];
}

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export all user data (GDPR Article 20 - Right to data portability).
   */
  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw i18nNotFound('auth.userNotFound');
    }

    // Fetch all user data in parallel
    const [bookings, listings, reviewsGiven, reviewsReceived, messages, favorites, notifications, sessions] =
      await Promise.all([
        this.prisma.booking.findMany({
          where: { renterId: userId },
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            createdAt: true,
            listing: { select: { title: true } },
          },
        }),
        this.prisma.listing.findMany({
          where: { ownerId: userId },
          select: {
            id: true,
            title: true,
            description: true,
            basePrice: true,
            status: true,
            city: true,
            createdAt: true,
          },
        }),
        this.prisma.review.findMany({
          where: { reviewerId: userId },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        }),
        this.prisma.review.findMany({
          where: { revieweeId: userId },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        }),
        this.prisma.message.findMany({
          where: { senderId: userId },
          select: {
            id: true,
            content: true,
            createdAt: true,
            conversationId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }),
        this.prisma.favoriteListing.findMany({
          where: { userId },
          select: {
            listingId: true,
            createdAt: true,
            listing: { select: { title: true } },
          },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            read: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        this.prisma.session.findMany({
          where: { userId },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
          },
        }),
      ]);

    // Sanitize profile
    const {
      passwordHash,
      mfaSecret,
      emailVerificationToken,
      passwordResetToken,
      ...profileData
    } = user;

    return {
      exportedAt: new Date().toISOString(),
      profile: profileData,
      bookings,
      listings,
      reviews: [
        ...reviewsGiven.map((r) => ({ ...r, type: 'given' })),
        ...reviewsReceived.map((r) => ({ ...r, type: 'received' })),
      ],
      messages,
      favorites: favorites.map((f) => ({
        listingId: f.listingId,
        listingTitle: (f as any).listing?.title,
        addedAt: f.createdAt,
      })),
      notifications,
      sessions,
    };
  }
}
