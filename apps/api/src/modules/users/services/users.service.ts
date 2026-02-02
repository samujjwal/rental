import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { User, UserStatus, VerificationStatus } from '@rental-portal/database';

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  bio?: string;
  profilePhotoUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async findById(id: string): Promise<User | null> {
    // Check cache first
    const cached = await this.cacheService.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (user) {
      await this.cacheService.set(`user:${id}`, user, 900); // 15 minutes
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    // Invalidate cache
    await this.cacheService.del(`user:${userId}`);

    return user;
  }

  async uploadProfilePhoto(userId: string, photoUrl: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl: photoUrl },
    });

    await this.cacheService.del(`user:${userId}`);

    return user;
  }

  async updateVerificationStatus(
    userId: string,
    status: VerificationStatus,
    documentUrl?: string,
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        idVerificationStatus: status,
        idVerificationUrl: documentUrl,
      },
    });

    await this.cacheService.del(`user:${userId}`);

    return user;
  }

  async getUserStats(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [listingsCount, bookingsCount, taskBookingsAsOwner, reviewsGiven, reviewsReceived] =
      await Promise.all([
        this.prisma.listing.count({ where: { ownerId: userId } }),
        this.prisma.booking.count({ where: { renterId: userId } }),
        this.prisma.booking.count({ where: { ownerId: userId } }),
        this.prisma.review.count({ where: { reviewerId: userId } }),
        this.prisma.review.count({ where: { revieweeId: userId } }),
      ]);

    return {
      listingsCount,
      bookingsAsRenter: bookingsCount,
      bookingsAsOwner: taskBookingsAsOwner,
      reviewsGiven,
      reviewsReceived,
      averageRating: user.averageRating,
      totalReviews: user.totalReviews,
      responseRate: user.responseRate,
      responseTime: user.responseTime,
      memberSince: user.createdAt,
    };
  }

  async suspendUser(userId: string, reason: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_SUSPENDED',
        entityType: 'User',
        entityId: userId,
        newValues: JSON.stringify({ status: UserStatus.SUSPENDED, reason }),
      },
    });

    await this.cacheService.del(`user:${userId}`);

    return user;
  }

  async activateUser(userId: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_ACTIVATED',
        entityType: 'User',
        entityId: userId,
        newValues: JSON.stringify({ status: UserStatus.ACTIVE }),
      },
    });

    await this.cacheService.del(`user:${userId}`);

    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
        email: `deleted_${userId}@deleted.com`, // Anonymize
      },
    });

    await this.cacheService.del(`user:${userId}`);
  }
}
