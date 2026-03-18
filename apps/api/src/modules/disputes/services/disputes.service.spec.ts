import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { CacheService } from '@/common/cache/cache.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { BookingStateMachineService } from '@/modules/bookings/services/booking-state-machine.service';
import { DisputeStatus, ResolutionType, UserRole } from '@rental-portal/database';

describe('DisputesService', () => {
  let service: DisputesService;
  let prisma: any;
  let emailService: { sendEmail: jest.Mock };
  let cacheService: { publish: jest.Mock; subscribe: jest.Mock };
  let mockNotificationsService: { sendNotification: jest.Mock };

  const renterId = 'renter-1';
  const ownerId = 'owner-1';
  const adminId = 'admin-1';
  const NON_ADMIN_ROLE = UserRole.USER;
  const bookingId = 'booking-1';
  const disputeId = 'dispute-1';

  const mockBooking = {
    id: bookingId,
    renterId,
    listing: { id: 'list-1', ownerId, title: 'Drill' },
    disputes: [],
  };

  const mockDispute = {
    id: disputeId,
    bookingId,
    initiatorId: renterId,
    defendantId: ownerId,
    title: 'Damaged item',
    type: 'PROPERTY_DAMAGE',
    description: 'Item was damaged',
    status: DisputeStatus.OPEN,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    cacheService = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn().mockResolvedValue(undefined) };
    mockNotificationsService = { sendNotification: jest.fn().mockResolvedValue(undefined) };
    
    prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
      booking: { findUnique: jest.fn() },
      dispute: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      disputeResolution: { upsert: jest.fn() },
      disputeResponse: { create: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: CacheService, useValue: cacheService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        {
          provide: BookingStateMachineService,
          useValue: {
            transition: jest.fn().mockResolvedValue({ success: true }),
            getValidTransitions: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  describe('createDispute', () => {
    it('should create a dispute as renter', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.dispute.create.mockResolvedValue(mockDispute);
      prisma.user.findUnique.mockResolvedValue({ email: 'owner@test.com', firstName: 'Owner' });

      const result = await service.createDispute(renterId, {
        bookingId,
        title: 'Damaged item',
        type: 'PROPERTY_DAMAGE',
        description: 'Item was damaged',
      });

      expect(result.id).toBe(disputeId);
      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            initiatorId: renterId,
            defendantId: ownerId,
            status: DisputeStatus.OPEN,
          }),
        }),
      );
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should create a dispute as owner', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);
      prisma.dispute.create.mockResolvedValue({
        ...mockDispute,
        initiatorId: ownerId,
        defendantId: renterId,
      });
      prisma.user.findUnique.mockResolvedValue({ email: 'renter@test.com', firstName: 'Renter' });

      const result = await service.createDispute(ownerId, {
        bookingId,
        title: 'Missing accessory',
        type: 'MISSING_ITEMS',
        description: 'Accessory was not returned',
      });

      expect(result.initiatorId).toBe(ownerId);
      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            initiatorId: ownerId,
            defendantId: renterId,
            status: DisputeStatus.OPEN,
          }),
        }),
      );
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should throw NotFoundException when booking not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.createDispute(renterId, {
          bookingId: 'missing',
          title: 'Test',
          type: 'OTHER',
          description: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not party to booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.createDispute('stranger', {
          bookingId,
          title: 'Test',
          type: 'OTHER',
          description: 'Test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when active dispute exists', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        disputes: [{ status: DisputeStatus.OPEN }],
      });

      await expect(
        service.createDispute(renterId, {
          bookingId,
          title: 'Test',
          type: 'OTHER',
          description: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDispute', () => {
    it('should return dispute for initiator', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        booking: { listing: { owner: { id: ownerId } }, renter: { id: renterId } },
        initiator: { id: renterId },
        defendant: { id: ownerId },
        responses: [],
      });
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });

      const result = await service.getDispute(disputeId, renterId);

      expect(result.id).toBe(disputeId);
    });

    it('should throw NotFoundException when dispute not found', async () => {
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.getDispute('missing', renterId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        booking: {},
        initiator: { id: renterId },
        defendant: { id: ownerId },
        responses: [],
      });
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });

      await expect(service.getDispute(disputeId, 'stranger')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to view any dispute', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        booking: {},
        initiator: { id: renterId },
        defendant: { id: ownerId },
        responses: [],
      });
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });

      const result = await service.getDispute(disputeId, adminId);
      expect(result).toBeDefined();
    });
  });

  describe('getUserDisputes', () => {
    it('should return paginated disputes', async () => {
      prisma.dispute.findMany.mockResolvedValue([mockDispute]);
      prisma.dispute.count.mockResolvedValue(1);

      const result = await service.getUserDisputes(renterId);

      expect(result.disputes).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.dispute.findMany.mockResolvedValue([]);
      prisma.dispute.count.mockResolvedValue(0);

      await service.getUserDisputes(renterId, { status: DisputeStatus.OPEN });

      expect(prisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: DisputeStatus.OPEN }),
        }),
      );
    });
  });

  describe('updateDispute (admin)', () => {
    it('should allow admin to update dispute status', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        status: DisputeStatus.UNDER_REVIEW,
      });
      prisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: DisputeStatus.RESOLVED,
      });

      const result = await service.updateDispute(disputeId, adminId, {
        status: DisputeStatus.RESOLVED,
      });

      expect(result.status).toBe(DisputeStatus.RESOLVED);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });

      await expect(
        service.updateDispute(disputeId, renterId, { status: DisputeStatus.RESOLVED }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing dispute', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDispute('missing', adminId, { status: DisputeStatus.RESOLVED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveDisputeAdmin', () => {
    it('normalizes REFUND decisions to a resolution enum before persisting', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        amount: '25',
      });
      prisma.disputeResolution.upsert.mockResolvedValue({ id: 'resolution-1' });
      prisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: DisputeStatus.RESOLVED,
      });

      const result = await service.resolveDisputeAdmin(disputeId, adminId, {
        decision: 'REFUND',
        refundAmount: 25,
        reason: 'Valid claim',
      });

      expect(prisma.disputeResolution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ type: ResolutionType.FULL_REFUND }),
          update: expect.objectContaining({ type: ResolutionType.FULL_REFUND }),
        }),
      );
      expect(result.status).toBe(DisputeStatus.RESOLVED);
    });

    it('maps DISMISS to DISMISSED before persisting', async () => {
      prisma.dispute.findUnique.mockResolvedValue(mockDispute);
      prisma.disputeResolution.upsert.mockResolvedValue({ id: 'resolution-1' });
      prisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: DisputeStatus.RESOLVED,
      });

      await service.resolveDisputeAdmin(disputeId, adminId, {
        decision: 'DISMISS',
      });

      expect(prisma.disputeResolution.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ type: ResolutionType.DISMISSED }),
          update: expect.objectContaining({ type: ResolutionType.DISMISSED }),
        }),
      );
    });
  });

  describe('closeDispute', () => {
    it('should allow initiator to close', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        booking: { listing: {} },
      });
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });
      prisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: DisputeStatus.CLOSED,
      });

      const result = await service.closeDispute(disputeId, renterId, 'Resolved offline');

      expect(result.status).toBe(DisputeStatus.CLOSED);
    });

    it('should throw ForbiddenException for non-party non-admin', async () => {
      prisma.dispute.findUnique.mockResolvedValue({
        ...mockDispute,
        booking: { listing: {} },
      });
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });

      await expect(
        service.closeDispute(disputeId, 'stranger', 'reason'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllDisputes (admin)', () => {
    it('should return all disputes for admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
      prisma.dispute.findMany.mockResolvedValue([mockDispute]);
      prisma.dispute.count.mockResolvedValue(1);

      const result = await service.getAllDisputes(adminId);

      expect(result.disputes).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });

      await expect(service.getAllDisputes(renterId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDisputeStats (admin)', () => {
    it('should return stats for admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
      prisma.dispute.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      const result = await service.getDisputeStats(adminId);

      expect(result.total).toBe(10);
      expect(result.byStatus.open).toBe(3);
      expect(result.byStatus.underReview).toBe(2);
      expect(result.byStatus.resolved).toBe(4);
      expect(result.byStatus.closed).toBe(1);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: NON_ADMIN_ROLE });

      await expect(service.getDisputeStats(renterId)).rejects.toThrow(ForbiddenException);
    });
  });
});
