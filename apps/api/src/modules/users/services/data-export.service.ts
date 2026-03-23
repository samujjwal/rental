import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { i18nNotFound } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface UserDataExport {
  exportedAt: string;
  profile: Record<string, unknown>;
  bookings: any[];
  listings: any[];
  reviews: any[];
  messages: any[];
  favorites: any[];
  notifications: any[];
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
    const [bookings, listings, reviewsGiven, reviewsReceived, messages, favorites, notifications] =
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
      ]);

    // Explicit profile allowlist — only portable, non-sensitive fields are exported.
    // Fields intentionally excluded: passwordHash, mfaSecret, mfaBackupCodes,
    // emailVerificationToken, passwordResetToken, passwordResetExpires, lastLoginIp,
    // loginAttempts, lockedUntil, stripeCustomerId, stripeConnectId,
    // stripeChargesEnabled, stripePayoutsEnabled, stripeOnboardingComplete,
    // governmentIdNumber, googleId, appleId, deletedAt.
    // Sessions (ipAddress, userAgent) are excluded as operational/fingerprinting data.
    const profileData: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      bio: user.bio,
      role: user.role,
      status: user.status,
      averageRating: user.averageRating,
      totalReviews: user.totalReviews,
      responseRate: user.responseRate,
      responseTime: user.responseTime,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      mfaEnabled: user.mfaEnabled,
      idVerificationStatus: user.idVerificationStatus,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      city: user.city,
      state: user.state,
      postalCode: user.postalCode,
      country: user.country,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

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
    };
  }
}
