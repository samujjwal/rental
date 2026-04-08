import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { DataExportService } from '../services/data-export.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;
  let dataExportService: jest.Mocked<DataExportService>;

  const mockUser = {
    id: 'u1',
    email: 'user@test.com',
    firstName: 'Sam',
    lastName: 'D',
    passwordHash: 'HASH_SHOULD_NOT_APPEAR',
    mfaSecret: 'SECRET_SHOULD_NOT_APPEAR',
    profilePhotoUrl: null,
    bio: 'Hi',
    averageRating: 4.5,
    totalReviews: 10,
    responseRate: 95,
    responseTime: '2h',
    idVerificationStatus: 'VERIFIED',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            updateProfile: jest.fn(),
            deleteUser: jest.fn(),
            upgradeToOwner: jest.fn(),
            getUserStats: jest.fn(),
          },
        },
        {
          provide: DataExportService,
          useValue: {
            exportUserData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    dataExportService = module.get(DataExportService) as jest.Mocked<DataExportService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getCurrentProfile ──

  describe('getCurrentProfile', () => {
    it('returns profile without sensitive fields', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      const result = await controller.getCurrentProfile('u1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('mfaSecret');
      expect(result).toHaveProperty('email', 'user@test.com');
    });

    it('throws NotFoundException when user not found', async () => {
      usersService.findById.mockResolvedValue(null as any);
      await expect(controller.getCurrentProfile('missing')).rejects.toThrow(NotFoundException);
    });

    it('handles database connection errors', async () => {
      usersService.findById.mockRejectedValue(new Error('Database connection failed'));
      await expect(controller.getCurrentProfile('u1')).rejects.toThrow('Database connection failed');
    });
  });

  // ── getProfile (alias endpoint) ──

  describe('getProfile', () => {
    it('returns same profile as getCurrentProfile', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      const result = await controller.getProfile('u1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email', 'user@test.com');
    });

    it('throws NotFoundException when user not found', async () => {
      usersService.findById.mockResolvedValue(null as any);
      await expect(controller.getProfile('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateProfile ──

  describe('updateProfile', () => {
    it('strips sensitive fields from response', async () => {
      usersService.updateProfile.mockResolvedValue(mockUser as any);
      const result = await controller.updateProfile('u1', { firstName: 'Updated' } as any);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('mfaSecret');
      expect(usersService.updateProfile).toHaveBeenCalledWith('u1', { firstName: 'Updated' });
    });

    it('handles phone number correctly', async () => {
      const userWithPhone = { ...mockUser, phone: '+1234567890' };
      usersService.updateProfile.mockResolvedValue(userWithPhone as any);
      const result = await controller.updateProfile('u1', { phone: '+1234567890' } as any);
      expect(result).toHaveProperty('phoneNumber', '+1234567890');
      expect(result).not.toHaveProperty('phone');
    });

    it('handles null phone number', async () => {
      usersService.updateProfile.mockResolvedValue(mockUser as any);
      const result = await controller.updateProfile('u1', { phone: null } as any);
      expect(result).toHaveProperty('phoneNumber', undefined);
    });

    it('handles validation errors', async () => {
      usersService.updateProfile.mockRejectedValue(new Error('Invalid email format'));
      await expect(controller.updateProfile('u1', { email: 'invalid' } as any)).rejects.toThrow('Invalid email format');
    });

    it('handles user not found during update', async () => {
      usersService.updateProfile.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.updateProfile('u1', { firstName: 'Updated' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteAccount ──

  describe('deleteAccount', () => {
    it('returns success message', async () => {
      const result = await controller.deleteAccount('u1');
      expect(usersService.deleteUser).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ message: 'Account deleted successfully' });
    });

    it('handles user not found during deletion', async () => {
      usersService.deleteUser.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.deleteAccount('missing')).rejects.toThrow(NotFoundException);
    });

    it('handles database errors during deletion', async () => {
      usersService.deleteUser.mockRejectedValue(new Error('Database constraint violation'));
      await expect(controller.deleteAccount('u1')).rejects.toThrow('Database constraint violation');
    });

    it('handles active bookings restriction', async () => {
      usersService.deleteUser.mockRejectedValue(new Error('Cannot delete user with active bookings'));
      await expect(controller.deleteAccount('u1')).rejects.toThrow('Cannot delete user with active bookings');
    });
  });

  // ── upgradeToOwner ──

  describe('upgradeToOwner', () => {
    it('strips sensitive fields from upgraded user', async () => {
      usersService.upgradeToOwner.mockResolvedValue({ ...mockUser, role: 'HOST' } as any);
      const result = await controller.upgradeToOwner('u1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(usersService.upgradeToOwner).toHaveBeenCalledWith('u1');
    });

    it('handles user not found during upgrade', async () => {
      usersService.upgradeToOwner.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.upgradeToOwner('missing')).rejects.toThrow(NotFoundException);
    });

    it('handles already upgraded user', async () => {
      usersService.upgradeToOwner.mockRejectedValue(new Error('User is already an owner'));
      await expect(controller.upgradeToOwner('u1')).rejects.toThrow('User is already an owner');
    });

    it('handles verification requirement', async () => {
      usersService.upgradeToOwner.mockRejectedValue(new Error('User must complete identity verification first'));
      await expect(controller.upgradeToOwner('u1')).rejects.toThrow('User must complete identity verification first');
    });
  });

  // ── getUserStats ──

  describe('getUserStats', () => {
    it('delegates to service', async () => {
      const stats = { totalBookings: 5, totalSpent: 10000 };
      usersService.getUserStats.mockResolvedValue(stats as any);
      expect(await controller.getUserStats('u1')).toBe(stats);
    });

    it('handles user not found', async () => {
      usersService.getUserStats.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.getUserStats('missing')).rejects.toThrow(NotFoundException);
    });

    it('handles stats calculation errors', async () => {
      usersService.getUserStats.mockRejectedValue(new Error('Stats calculation failed'));
      await expect(controller.getUserStats('u1')).rejects.toThrow('Stats calculation failed');
    });

    it('returns complete stats structure', async () => {
      const stats = {
        totalBookings: 5,
        totalSpent: 10000,
        totalEarned: 5000,
        averageRating: 4.5,
        responseRate: 95,
        completedBookings: 4,
        cancelledBookings: 1,
      };
      usersService.getUserStats.mockResolvedValue(stats as any);
      const result = await controller.getUserStats('u1');
      expect(result).toHaveProperty('totalBookings');
      expect(result).toHaveProperty('totalSpent');
      expect(result).toHaveProperty('averageRating');
    });
  });

  // ── getUserProfile ──

  describe('getUserProfile', () => {
    it('returns only public fields', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      const result = await controller.getUserProfile('u1');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('firstName');
      expect(result).toHaveProperty('averageRating');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('mfaSecret');
    });

    it('throws NotFoundException when user not found', async () => {
      usersService.findById.mockResolvedValue(null as any);
      await expect(controller.getUserProfile('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns all required public profile fields', async () => {
      usersService.findById.mockResolvedValue(mockUser as any);
      const result = await controller.getUserProfile('u1');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('firstName');
      expect(result).toHaveProperty('lastName');
      expect(result).toHaveProperty('profilePhotoUrl');
      expect(result).toHaveProperty('bio');
      expect(result).toHaveProperty('averageRating');
      expect(result).toHaveProperty('totalReviews');
      expect(result).toHaveProperty('responseRate');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('idVerificationStatus');
      expect(result).toHaveProperty('createdAt');
    });

    it('handles null values gracefully', async () => {
      const userWithNulls = {
        ...mockUser,
        profilePhotoUrl: null,
        bio: null,
        responseRate: null,
        responseTime: null,
      };
      usersService.findById.mockResolvedValue(userWithNulls as any);
      const result = await controller.getUserProfile('u1');
      expect(result.profilePhotoUrl).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.responseRate).toBeNull();
      expect(result.responseTime).toBeNull();
    });
  });

  // ── exportData ──

  describe('exportData', () => {
    it('delegates to DataExportService', async () => {
      const exportData = { user: {}, bookings: [] };
      dataExportService.exportUserData.mockResolvedValue(exportData as any);
      const result = await controller.exportData('u1');
      expect(dataExportService.exportUserData).toHaveBeenCalledWith('u1');
      expect(result).toBe(exportData);
    });

    it('handles user not found during export', async () => {
      dataExportService.exportUserData.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.exportData('missing')).rejects.toThrow(NotFoundException);
    });

    it('handles export service errors', async () => {
      dataExportService.exportUserData.mockRejectedValue(new Error('Export service unavailable'));
      await expect(controller.exportData('u1')).rejects.toThrow('Export service unavailable');
    });

    it('handles large dataset export', async () => {
      const largeExportData = {
        exportedAt: new Date().toISOString(),
        profile: mockUser,
        bookings: new Array(1000).fill({}),
        listings: new Array(200).fill({}),
        reviews: new Array(500).fill({}),
        messages: new Array(300).fill({}),
        favorites: new Array(100).fill({}),
        notifications: new Array(200).fill({}),
      };
      dataExportService.exportUserData.mockResolvedValue(largeExportData);
      const result = await controller.exportData('u1');
      expect(result.bookings).toHaveLength(1000);
      expect(result.reviews).toHaveLength(500);
      expect(result.messages).toHaveLength(300);
      expect(result.favorites).toHaveLength(100);
    });
  });

  // ── error handling and security tests ──

  describe('error handling and security', () => {
    it('handles malformed user IDs', async () => {
      usersService.findById.mockRejectedValue(new Error('Invalid user ID format'));
      await expect(controller.getCurrentProfile('invalid-id')).rejects.toThrow('Invalid user ID format');
    });

    it('prevents sensitive data leakage', async () => {
      const userWithSensitiveData = {
        ...mockUser,
        passwordHash: 'hashed_password',
        mfaSecret: 'mfa_secret',
        phone: '+1234567890',
      };
      usersService.findById.mockResolvedValue(userWithSensitiveData as any);
      const result = await controller.getCurrentProfile('u1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('mfaSecret');
      // Phone is allowed in getCurrentProfile (only stripped in updateProfile response)
      expect(result).toHaveProperty('phone', '+1234567890');
    });

    it('handles concurrent profile updates', async () => {
      usersService.updateProfile.mockRejectedValue(new Error('Concurrent modification detected'));
      await expect(controller.updateProfile('u1', { firstName: 'Updated' } as any)).rejects.toThrow('Concurrent modification detected');
    });
  });
});
