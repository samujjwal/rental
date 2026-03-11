import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DataExportService } from './data-export.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('DataExportService', () => {
  let service: DataExportService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-export-1';
  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: 'hashed-secret',
    mfaSecret: 'mfa-secret',
    emailVerificationToken: 'token-1',
    passwordResetToken: 'reset-token',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataExportService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            booking: { findMany: jest.fn() },
            listing: { findMany: jest.fn() },
            review: { findMany: jest.fn() },
            message: { findMany: jest.fn() },
            favoriteListing: { findMany: jest.fn() },
            notification: { findMany: jest.fn() },
            session: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(DataExportService);
    prisma = module.get(PrismaService);
  });

  it('throws NotFoundException when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.exportUserData('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('exports all user data categories', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }]);
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([{ id: 'l1' }]);
    (prisma.review.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'r-given' }])   // reviewsGiven
      .mockResolvedValueOnce([{ id: 'r-received' }]); // reviewsReceived
    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.favoriteListing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.session.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.exportUserData(mockUserId);

    expect(result.exportedAt).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.bookings).toHaveLength(1);
    expect(result.listings).toHaveLength(1);
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews[0]).toEqual(expect.objectContaining({ type: 'given' }));
    expect(result.reviews[1]).toEqual(expect.objectContaining({ type: 'received' }));
  });

  it('sanitizes sensitive fields from profile', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.favoriteListing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.session.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.exportUserData(mockUserId);

    expect(result.profile.passwordHash).toBeUndefined();
    expect(result.profile.mfaSecret).toBeUndefined();
    expect(result.profile.emailVerificationToken).toBeUndefined();
    expect(result.profile.passwordResetToken).toBeUndefined();
    expect(result.profile.email).toBe('test@example.com');
    expect(result.profile.firstName).toBe('Test');
  });

  it('transforms favorites to include listing title', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.listing.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.favoriteListing.findMany as jest.Mock).mockResolvedValue([
      {
        listingId: 'l-1',
        createdAt: new Date('2024-06-01'),
        listing: { title: 'Nice Apartment' },
      },
    ]);
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.session.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.exportUserData(mockUserId);

    expect(result.favorites[0]).toEqual({
      listingId: 'l-1',
      listingTitle: 'Nice Apartment',
      addedAt: new Date('2024-06-01'),
    });
  });
});
