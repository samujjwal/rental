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
  });

  // ── deleteAccount ──

  describe('deleteAccount', () => {
    it('returns success message', async () => {
      const result = await controller.deleteAccount('u1');
      expect(usersService.deleteUser).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ message: 'Account deleted successfully' });
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
  });

  // ── getUserStats ──

  describe('getUserStats', () => {
    it('delegates to service', async () => {
      const stats = { totalBookings: 5, totalSpent: 10000 };
      usersService.getUserStats.mockResolvedValue(stats as any);
      expect(await controller.getUserStats('u1')).toBe(stats);
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
  });
});
