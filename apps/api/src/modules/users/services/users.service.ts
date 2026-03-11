import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { i18nNotFound,i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { FieldEncryptionService } from '../../../common/encryption/field-encryption.service';
import { ConfigCascadeService } from '@/common/config/config-cascade.service';
import { User, UserRole, UserStatus, VerificationStatus } from '@rental-portal/database';
import { UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly configCascade: ConfigCascadeService,
  ) {}

  // Fields that should NEVER be cached or leaked
  private static readonly SENSITIVE_FIELDS = [
    'passwordHash',
    'mfaSecret',
    'mfaBackupCodes',
    'passwordResetToken',
    'passwordResetExpiry',
    'emailVerificationToken',
    'governmentIdNumber',
  ] as const;

  private stripSensitiveFields<T extends Record<string, any>>(user: T): T {
    const stripped = { ...user };
    for (const field of UsersService.SENSITIVE_FIELDS) {
      delete stripped[field];
    }
    return stripped;
  }

  async findById(id: string): Promise<User | null> {
    // Check cache first
    const cached = await this.cacheService.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (user) {
      const safe = this.stripSensitiveFields(user);
      await this.cacheService.set(`user:${id}`, safe, 900); // 15 minutes
      return safe;
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const allowedFields: Array<keyof UpdateProfileDto> = [
      'firstName',
      'lastName',
      'phoneNumber', // maps to 'phone' in DB — see below
      'bio',
      'profilePhotoUrl',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'postalCode',
      'country',
    ];

    const updateData = Object.fromEntries(
      Object.entries(dto || {}).filter(
        ([key, value]) => allowedFields.includes(key as keyof UpdateProfileDto) && value !== undefined,
      ),
    ) as UpdateProfileDto & { phone?: string };

    // Map DTO 'phoneNumber' → DB 'phone' (phoneNumber column was removed)
    if (updateData.phoneNumber !== undefined) {
      if (!/^\+?[1-9]\d{7,14}$/.test(updateData.phoneNumber)) {
        throw i18nBadRequest('validation.invalidPhoneFormat');
      }
      (updateData as any).phone = updateData.phoneNumber;
      delete (updateData as any).phoneNumber;
    }

    if (typeof updateData.bio === 'string') {
      updateData.bio = updateData.bio.replace(/<[^>]*>/g, '').trim();
    }

    if (Object.keys(updateData).length === 0) {
      const existing = await this.findById(userId);
      if (!existing) {
        throw i18nNotFound('auth.userNotFound');
      }
      return existing;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Persist locale/currency/timezone to UserPreferences (cascade source)
    const prefUpdates: Record<string, string> = {};
    if (dto.preferredLanguage) prefUpdates.language = dto.preferredLanguage;
    if (dto.preferredCurrency) prefUpdates.currency = dto.preferredCurrency;
    if (dto.timezone) prefUpdates.timezone = dto.timezone;

    if (Object.keys(prefUpdates).length > 0) {
      await this.prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, ...prefUpdates },
        update: prefUpdates,
      });
      await this.configCascade.invalidate(userId);
    }

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
      throw i18nNotFound('auth.userNotFound');
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
        email: `deleted_${userId}@gharbatai.deleted`, // Anonymize
      },
    });

    // Invalidate all sessions for deleted user
    await this.prisma.session.deleteMany({ where: { userId } });

    // Clear all cached data
    await this.cacheService.del(`user:${userId}`);
    await this.cacheService.del(`sessions:${userId}`);
  }

  async upgradeToOwner(userId: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.HOST },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'USER_ROLE_UPDATED',
        entityType: 'User',
        entityId: userId,
        newValues: JSON.stringify({ role: UserRole.HOST }),
      },
    });

    await this.cacheService.del(`user:${userId}`);

    return user;
  }
}
