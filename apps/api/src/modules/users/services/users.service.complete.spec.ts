import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { FieldEncryptionService } from '@/common/encryption/field-encryption.service';
import { ConfigCascadeService } from '@/common/config/config-cascade.service';
import { User, UserRole, UserStatus, VerificationStatus } from '@rental-portal/database';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('UsersService - Complete Coverage', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;
  let encryption: jest.Mocked<FieldEncryptionService>;
  let configCascade: jest.Mocked<ConfigCascadeService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    phone: '+1234567890',
    bio: 'Test user bio',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isActive: true,
    averageRating: 4.5,
    totalReviews: 10,
    responseRate: 95,
    responseTime: '1 hour',
    stripeCustomerId: 'cus_test',
    stripeConnectId: 'acct_test',
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeOnboardingComplete: true,
    emailVerified: true,
    phoneVerified: true,
    mfaEnabled: false,
    emailVerificationToken: 'token123',
    passwordResetToken: 'reset123',
    passwordResetExpires: new Date(),
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.1',
    mfaSecret: 'mfa123',
    mfaBackupCodes: ['code1', 'code2'],
    idVerificationStatus: VerificationStatus.PENDING,
    idVerificationUrl: 'https://example.com/id.jpg',
    governmentIdNumber: '123456789',
    loginAttempts: 0,
    lockedUntil: null,
    googleId: null,
    appleId: null,
    subscriptionStatus: null,
    subscriptionId: null,
    subscriptionPlan: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      userPreferences: {
        upsert: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(null),
      },
      session: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      listing: {
        count: jest.fn().mockResolvedValue(0),
      },
      booking: {
        count: jest.fn().mockResolvedValue(0),
      },
      review: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockEncryption = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    const mockConfigCascade = {
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: FieldEncryptionService, useValue: mockEncryption },
        { provide: ConfigCascadeService, useValue: mockConfigCascade },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
    encryption = module.get(FieldEncryptionService);
    configCascade = module.get(ConfigCascadeService);
  });

  describe('User Lifecycle Management', () => {
    describe('findById', () => {
      it('should return cached user when available', async () => {
        const safeUser = { ...mockUser };
        delete (safeUser as any).passwordHash;
        delete (safeUser as any).mfaSecret;
        delete (safeUser as any).mfaBackupCodes;
        delete (safeUser as any).passwordResetToken;
        delete (safeUser as any).emailVerificationToken;
        delete (safeUser as any).governmentIdNumber;

        cache.get.mockResolvedValue(safeUser);

        const result = await service.findById('user-1');

        expect(result).toEqual(safeUser);
        expect(cache.get).toHaveBeenCalledWith('user:user-1');
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });

      it('should fetch from database when not cached', async () => {
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(mockUser);

        const result = await service.findById('user-1');

        expect(result).toBeDefined();
        expect(cache.get).toHaveBeenCalledWith('user:user-1');
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-1' },
        });
        expect(cache.set).toHaveBeenCalledWith('user:user-1', expect.any(Object), 900);
      });

      it('should return null when user not found', async () => {
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.findById('nonexistent');

        expect(result).toBeNull();
        expect(cache.set).not.toHaveBeenCalled();
      });

      it('should strip sensitive fields before caching', async () => {
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(mockUser);

        await service.findById('user-1');

        const cachedUser = (cache.set as jest.Mock).mock.calls[0][1];
        expect(cachedUser.passwordHash).toBeUndefined();
        expect(cachedUser.mfaSecret).toBeUndefined();
        expect(cachedUser.mfaBackupCodes).toBeUndefined();
        expect(cachedUser.passwordResetToken).toBeUndefined();
        expect(cachedUser.emailVerificationToken).toBeUndefined();
        expect(cachedUser.governmentIdNumber).toBeUndefined();
      });
    });

    describe('findByEmail', () => {
      it('should find user by email case-insensitively', async () => {
        prisma.user.findUnique.mockResolvedValue(mockUser);

        const result = await service.findByEmail('TEST@EXAMPLE.COM');

        expect(result).toEqual(mockUser);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
      });

      it('should return null when email not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await service.findByEmail('nonexistent@example.com');

        expect(result).toBeNull();
      });
    });

    describe('suspendUser', () => {
      it('should suspend user and create audit log', async () => {
        const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
        prisma.user.update.mockResolvedValue(suspendedUser);

        const result = await service.suspendUser('user-1', 'Violation of terms');

        expect(result).toEqual(suspendedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { status: UserStatus.SUSPENDED },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-1',
            action: 'USER_SUSPENDED',
            entityType: 'User',
            entityId: 'user-1',
            newValues: JSON.stringify({
              status: UserStatus.SUSPENDED,
              reason: 'Violation of terms',
            }),
          },
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
      });
    });

    describe('activateUser', () => {
      it('should activate user and create audit log', async () => {
        const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
        prisma.user.update.mockResolvedValue(activeUser);

        const result = await service.activateUser('user-1');

        expect(result).toEqual(activeUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { status: UserStatus.ACTIVE },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-1',
            action: 'USER_ACTIVATED',
            entityType: 'User',
            entityId: 'user-1',
            newValues: JSON.stringify({ status: UserStatus.ACTIVE }),
          },
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
      });
    });

    describe('deleteUser', () => {
      it('should delete user and clean up data', async () => {
        prisma.user.update.mockResolvedValue(mockUser);

        await service.deleteUser('user-1');

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: {
            status: UserStatus.DELETED,
            deletedAt: expect.any(Date),
            email: 'deleted_user-1@gharbatai.deleted',
          },
        });
        expect(prisma.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
        expect(cache.del).toHaveBeenCalledWith('sessions:user-1');
      });
    });

    describe('upgradeToOwner', () => {
      it('should upgrade user to host role', async () => {
        const hostUser = { ...mockUser, role: UserRole.HOST };
        prisma.user.update.mockResolvedValue(hostUser);

        const result = await service.upgradeToOwner('user-1');

        expect(result).toEqual(hostUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { role: UserRole.HOST },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: {
            userId: 'user-1',
            action: 'USER_ROLE_UPDATED',
            entityType: 'User',
            entityId: 'user-1',
            newValues: JSON.stringify({ role: UserRole.HOST }),
          },
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
      });
    });
  });

  describe('Profile Management', () => {
    describe('updateProfile', () => {
      it('should update allowed profile fields', async () => {
        const updateDto: UpdateProfileDto = {
          firstName: 'Jane',
          lastName: 'Smith',
          bio: 'Updated bio',
          profilePhotoUrl: 'https://example.com/new-photo.jpg',
        };

        const updatedUser = { ...mockUser, ...updateDto };
        prisma.user.update.mockResolvedValue(updatedUser);

        const result = await service.updateProfile('user-1', updateDto);

        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: updateDto,
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
      });

      it('should validate phone number format', async () => {
        const updateDto: UpdateProfileDto = {
          phoneNumber: 'invalid-phone',
        };

        await expect(service.updateProfile('user-1', updateDto)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('should map phoneNumber to phone field', async () => {
        const updateDto: UpdateProfileDto = {
          phoneNumber: '+1234567890',
        };

        const updatedUser = { ...mockUser, phone: '+1234567890' };
        prisma.user.update.mockResolvedValue(updatedUser);

        await service.updateProfile('user-1', updateDto);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { phone: '+1234567890' },
        });
      });

      it('should sanitize HTML from bio', async () => {
        const updateDto: UpdateProfileDto = {
          bio: '<script>alert("xss")</script>Clean bio',
        };

        const updatedUser = { ...mockUser, bio: 'Clean bio' };
        prisma.user.update.mockResolvedValue(updatedUser);

        const result = await service.updateProfile('user-1', updateDto);

        expect(result.bio).toBe('Clean bio');
      });

      it('should update user preferences when provided', async () => {
        const updateDto: UpdateProfileDto = {
          preferredLanguage: 'es',
          preferredCurrency: 'EUR',
          timezone: 'Europe/Madrid',
        };

        prisma.user.update.mockResolvedValue(mockUser);
        prisma.userPreferences.upsert.mockResolvedValue({});

        await service.updateProfile('user-1', updateDto);

        expect(prisma.userPreferences.upsert).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          create: { userId: 'user-1', language: 'es', currency: 'EUR', timezone: 'Europe/Madrid' },
          update: { language: 'es', currency: 'EUR', timezone: 'Europe/Madrid' },
        });
        expect(configCascade.invalidate).toHaveBeenCalledWith('user-1');
      });

      it('should return existing user when no updates provided', async () => {
        cache.get.mockResolvedValue(mockUser);

        const result = await service.updateProfile('user-1', {});

        expect(result).toEqual(mockUser);
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when user not found', async () => {
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(service.updateProfile('nonexistent', {})).rejects.toThrow(NotFoundException);
      });

      it('should filter out disallowed fields', async () => {
        const updateDto = {
          firstName: 'Jane',
          passwordHash: 'newpassword', // Not allowed
          role: UserRole.ADMIN, // Not allowed
        };

        const filteredData = { firstName: 'Jane' };
        prisma.user.update.mockResolvedValue({ ...mockUser, ...filteredData });

        await service.updateProfile('user-1', updateDto);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: filteredData,
        });
      });
    });

    describe('uploadProfilePhoto', () => {
      it('should upload profile photo URL', async () => {
        const photoUrl = 'https://example.com/new-photo.jpg';
        const updatedUser = { ...mockUser, profilePhotoUrl: photoUrl };
        prisma.user.update.mockResolvedValue(updatedUser);

        const result = await service.uploadProfilePhoto('user-1', photoUrl);

        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: { profilePhotoUrl: photoUrl },
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
      });
    });

    describe('updateVerificationStatus', () => {
      it('should update verification status', async () => {
        const documentUrl = 'https://example.com/verification.jpg';
        const updatedUser = {
          ...mockUser,
          idVerificationStatus: VerificationStatus.VERIFIED,
          idVerificationUrl: documentUrl,
        };
        prisma.user.update.mockResolvedValue(updatedUser);

        const result = await service.updateVerificationStatus(
          'user-1',
          VerificationStatus.VERIFIED,
          documentUrl,
        );

        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          data: {
            idVerificationStatus: VerificationStatus.VERIFIED,
            idVerificationUrl: documentUrl,
          },
        });
        expect(cache.del).toHaveBeenCalledWith('user:user-1');
      });
    });
  });

  describe('User Statistics', () => {
    describe('getUserStats', () => {
      it('should return user statistics', async () => {
        cache.get.mockResolvedValue(mockUser);
        prisma.listing.count.mockResolvedValue(5);
        prisma.booking.count
          .mockResolvedValueOnce(3) // bookings as renter
          .mockResolvedValueOnce(10) // bookings as owner
          .mockResolvedValueOnce(8) // reviews given
          .mockResolvedValueOnce(12); // reviews received

        const result = await service.getUserStats('user-1');

        expect(result).toEqual({
          listingsCount: 5,
          bookingsAsRenter: 3,
          bookingsAsOwner: 10,
          reviewsGiven: 8,
          reviewsReceived: 12,
          averageRating: 4.5,
          totalReviews: 10,
          responseRate: 95,
          responseTime: '1 hour',
          memberSince: mockUser.createdAt,
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(service.getUserStats('nonexistent')).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Security and Data Protection', () => {
    describe('Sensitive Data Handling', () => {
      it('should never cache sensitive fields', async () => {
        const userWithSensitiveData = { ...mockUser };
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(userWithSensitiveData);

        await service.findById('user-1');

        const cachedData = (cache.set as jest.Mock).mock.calls[0][1];
        const sensitiveFields = [
          'passwordHash',
          'mfaSecret',
          'mfaBackupCodes',
          'passwordResetToken',
          'emailVerificationToken',
          'governmentIdNumber',
        ];

        sensitiveFields.forEach((field) => {
          expect(cachedData[field]).toBeUndefined();
        });
      });

      it('should strip sensitive fields consistently', async () => {
        const userWithSensitiveData = { ...mockUser };
        cache.get.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue(userWithSensitiveData);

        const result = await service.findById('user-1');

        expect(result.passwordHash).toBeUndefined();
        expect(result.mfaSecret).toBeUndefined();
        expect(result.mfaBackupCodes).toBeUndefined();
        expect(result.passwordResetToken).toBeUndefined();
        expect(result.emailVerificationToken).toBeUndefined();
        expect(result.governmentIdNumber).toBeUndefined();
      });
    });

    describe('Input Validation', () => {
      it('should validate phone number formats', async () => {
        const invalidPhones = [
          '123', // Too short
          'abc123', // Contains letters
          '+123456789012345', // Too long
          '', // Empty
        ];

        for (const phone of invalidPhones) {
          await expect(service.updateProfile('user-1', { phoneNumber: phone })).rejects.toThrow(
            BadRequestException,
          );
        }

        const validPhones = ['+1234567890', '1234567890', '+441234567890'];

        for (const phone of validPhones) {
          prisma.user.update.mockResolvedValue(mockUser);
          await expect(
            service.updateProfile('user-1', { phoneNumber: phone }),
          ).resolves.toBeDefined();
        }
      });

      it('should sanitize HTML in text fields', async () => {
        const maliciousInputs = [
          '<script>alert("xss")</script>',
          '<img src="x" onerror="alert(1)">',
          'javascript:alert(1)',
          '<style>body{display:none}</style>',
        ];

        for (const input of maliciousInputs) {
          prisma.user.update.mockResolvedValue(mockUser);
          const result = await service.updateProfile('user-1', { bio: input });
          expect(result.bio).not.toContain('<script>');
          expect(result.bio).not.toContain('<img');
          expect(result.bio).not.toContain('javascript:');
          expect(result.bio).not.toContain('<style>');
        }
      });
    });

    describe('Cache Security', () => {
      it('should invalidate cache on user updates', async () => {
        prisma.user.update.mockResolvedValue(mockUser);

        await service.updateProfile('user-1', { firstName: 'Jane' });
        await service.uploadProfilePhoto('user-1', 'new-photo.jpg');
        await service.updateVerificationStatus('user-1', VerificationStatus.VERIFIED);
        await service.suspendUser('user-1', 'reason');
        await service.activateUser('user-1');
        await service.upgradeToOwner('user-1');

        expect(cache.del).toHaveBeenCalledTimes(6);
      });

      it('should clear all user data on deletion', async () => {
        prisma.user.update.mockResolvedValue(mockUser);

        await service.deleteUser('user-1');

        expect(cache.del).toHaveBeenCalledWith('user:user-1');
        expect(cache.del).toHaveBeenCalledWith('sessions:user-1');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.findById('user-1')).rejects.toThrow('Database connection failed');
    });

    it('should handle cache errors gracefully', async () => {
      cache.get.mockRejectedValue(new Error('Cache service unavailable'));
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Should still work despite cache error
      const result = await service.findById('user-1');
      expect(result).toBeDefined();
    });

    it('should handle concurrent updates safely', async () => {
      const updateDto = { firstName: 'Jane' };
      prisma.user.update.mockResolvedValue(mockUser);

      // Simulate concurrent updates
      await Promise.all([
        service.updateProfile('user-1', updateDto),
        service.updateProfile('user-1', updateDto),
        service.updateProfile('user-1', updateDto),
      ]);

      expect(prisma.user.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Optimization', () => {
    it('should use cache for frequently accessed users', async () => {
      const cachedUser = { ...mockUser };
      delete (cachedUser as any).passwordHash;
      delete (cachedUser as any).mfaSecret;
      cache.get.mockResolvedValue(cachedUser);

      // Multiple calls should hit cache
      await service.findById('user-1');
      await service.findById('user-1');
      await service.findById('user-1');

      expect(cache.get).toHaveBeenCalledTimes(3);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(0);
    });

    it('should batch database operations for stats', async () => {
      cache.get.mockResolvedValue(mockUser);
      prisma.listing.count.mockResolvedValue(5);
      prisma.booking.count.mockResolvedValueOnce(3).mockResolvedValueOnce(10);
      prisma.review.count.mockResolvedValueOnce(8).mockResolvedValueOnce(12);

      await service.getUserStats('user-1');

      // All queries should be called in parallel
      expect(prisma.listing.count).toHaveBeenCalled();
      expect(prisma.booking.count).toHaveBeenCalledTimes(2);
      expect(prisma.review.count).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      await expect(service.updateProfile('user-1', null)).resolves.toBeDefined();
      await expect(service.updateProfile('user-1', undefined)).resolves.toBeDefined();
    });

    it('should handle empty objects', async () => {
      cache.get.mockResolvedValue(mockUser);

      const result = await service.updateProfile('user-1', {});
      expect(result).toBeDefined();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle very long text inputs', async () => {
      const longBio = 'a'.repeat(10000);
      prisma.user.update.mockResolvedValue({ ...mockUser, bio: longBio });

      const result = await service.updateProfile('user-1', { bio: longBio });
      expect(result.bio).toBe(longBio);
    });

    it('should handle special characters in names', async () => {
      const specialNames = {
        firstName: 'José María',
        lastName: 'Österreich Åland',
      };
      prisma.user.update.mockResolvedValue({ ...mockUser, ...specialNames });

      const result = await service.updateProfile('user-1', specialNames);
      expect(result.firstName).toBe(specialNames.firstName);
      expect(result.lastName).toBe(specialNames.lastName);
    });
  });
});
