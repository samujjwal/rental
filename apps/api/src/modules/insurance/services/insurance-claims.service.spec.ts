import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InsuranceClaimsService } from './insurance-claims.service';
import { ClaimStatus } from '@rental-portal/database';

describe('InsuranceClaimsService', () => {
  let service: InsuranceClaimsService;
  let prisma: any;
  let notificationsService: any;

  const userId = 'user-1';
  const adminId = 'admin-1';
  const policyId = 'policy-1';
  const claimId = 'claim-1';

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const mockPolicy = {
    id: policyId,
    userId,
    propertyId: 'prop-1',
    status: 'ACTIVE',
    startDate: lastYear,
    endDate: nextYear,
    coverageAmount: 100000,
    policyNumber: 'POL-001',
    provider: 'Test Insurance',
    property: { id: 'prop-1', title: 'Test Property' },
  };

  const mockClaim = {
    id: claimId,
    policyId,
    claimNumber: 'CLM-20240101-ABCD',
    claimAmount: 5000,
    approvedAmount: null,
    description: 'Damage claim',
    incidentDate: yesterday,
    status: ClaimStatus.PENDING,
    documents: [],
    submittedAt: now,
    notes: null,
    policy: mockPolicy,
    booking: null,
  };

  beforeEach(() => {
    prisma = {
      insurancePolicy: {
        findUnique: jest.fn(),
      },
      insuranceClaim: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    notificationsService = {
      sendNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new InsuranceClaimsService(prisma, notificationsService);
  });

  /* ─────────────────────────────────────────────────────────────────
   *  fileClaim
   * ───────────────────────────────────────────────────────────────── */
  describe('fileClaim', () => {
    const dto = {
      policyId,
      claimAmount: 5000,
      description: 'Damage claim',
      incidentDate: yesterday.toISOString(),
      documents: [],
    };

    it('should throw NotFoundException when policy does not exist', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(null);
      await expect(service.fileClaim(userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when policy belongs to another user', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...mockPolicy,
        userId: 'other-user',
      });
      await expect(service.fileClaim(userId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when policy is not ACTIVE', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...mockPolicy,
        status: 'EXPIRED',
      });
      await expect(service.fileClaim(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when policy is expired (endDate in past)', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...mockPolicy,
        endDate: lastYear, // already past
      });
      await expect(service.fileClaim(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when incident date is before policy start', async () => {
      const veryOldDate = new Date(now.getFullYear() - 5, 0, 1);
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...mockPolicy,
        startDate: tomorrow, // policy starts tomorrow
      });
      await expect(
        service.fileClaim(userId, { ...dto, incidentDate: veryOldDate.toISOString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when incident date is after policy end', async () => {
      const farFuture = new Date(now.getFullYear() + 5, 0, 1);
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...mockPolicy,
        endDate: yesterday, // policy ended yesterday
      });
      await expect(
        service.fileClaim(userId, { ...dto, incidentDate: farFuture.toISOString() }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when claim amount exceeds coverage', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...mockPolicy,
        coverageAmount: 1000,
      });
      await expect(
        service.fileClaim(userId, { ...dto, claimAmount: 50000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when provided bookingId does not exist', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(mockPolicy);
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.fileClaim(userId, { ...dto, bookingId: 'nonexistent-booking' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a claim successfully and send admin notification', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(mockPolicy);
      prisma.insuranceClaim.create.mockResolvedValue(mockClaim);

      const result = await service.fileClaim(userId, dto);

      expect(prisma.insuranceClaim.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            policyId,
            claimAmount: 5000,
            status: ClaimStatus.PENDING,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(result).toBe(mockClaim);
    });

    it('should create a claim with valid booking when bookingId is provided', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(mockPolicy);
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1' });
      prisma.insuranceClaim.create.mockResolvedValue({
        ...mockClaim,
        bookingId: 'booking-1',
      });

      const result = await service.fileClaim(userId, {
        ...dto,
        bookingId: 'booking-1',
      });
      expect(result.bookingId).toBe('booking-1');
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  getClaim
   * ───────────────────────────────────────────────────────────────── */
  describe('getClaim', () => {
    it('should throw NotFoundException when claim does not exist', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(null);
      await expect(service.getClaim(claimId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when non-admin user requests another user claim', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      await expect(service.getClaim(claimId, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('should return claim for the owner', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      const result = await service.getClaim(claimId, userId);
      expect(result).toBe(mockClaim);
    });

    it('should return any claim when userId is not provided (admin access)', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue({
        ...mockClaim,
        policy: { ...mockPolicy, userId: 'any-user' },
      });
      const result = await service.getClaim(claimId);
      expect(result).toBeDefined();
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  getUserClaims
   * ───────────────────────────────────────────────────────────────── */
  describe('getUserClaims', () => {
    it('should return all claims for a user when no status filter is given', async () => {
      prisma.insuranceClaim.findMany.mockResolvedValue([mockClaim]);
      const result = await service.getUserClaims(userId);
      expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ policy: { userId } }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should filter by status when provided', async () => {
      prisma.insuranceClaim.findMany.mockResolvedValue([mockClaim]);
      await service.getUserClaims(userId, ClaimStatus.PENDING);
      expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ClaimStatus.PENDING }),
        }),
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  getAllClaims
   * ───────────────────────────────────────────────────────────────── */
  describe('getAllClaims', () => {
    it('should return paginated claims with total count', async () => {
      prisma.insuranceClaim.findMany.mockResolvedValue([mockClaim]);
      prisma.insuranceClaim.count.mockResolvedValue(1);

      const result = await service.getAllClaims(undefined, 1, 20);

      expect(result).toEqual(
        expect.objectContaining({
          claims: [mockClaim],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      );
    });

    it('should filter by status when provided', async () => {
      prisma.insuranceClaim.findMany.mockResolvedValue([]);
      prisma.insuranceClaim.count.mockResolvedValue(0);

      await service.getAllClaims(ClaimStatus.APPROVED, 1, 10);

      expect(prisma.insuranceClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ClaimStatus.APPROVED },
        }),
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  reviewClaim
   * ───────────────────────────────────────────────────────────────── */
  describe('reviewClaim', () => {
    it('should throw NotFoundException when claim does not exist', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(null);
      await expect(
        service.reviewClaim(claimId, adminId, { status: 'APPROVED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when claim is not in PENDING status', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue({
        ...mockClaim,
        status: ClaimStatus.APPROVED,
      });
      await expect(
        service.reviewClaim(claimId, adminId, { status: 'APPROVED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when approved amount exceeds coverage', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue({
        ...mockClaim,
        policy: { ...mockPolicy, coverageAmount: 1000 },
      });
      await expect(
        service.reviewClaim(claimId, adminId, {
          status: 'APPROVED',
          approvedAmount: 999999,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve a PENDING claim with approved amount', async () => {
      const updatedClaim = {
        ...mockClaim,
        status: ClaimStatus.APPROVED,
        approvedAmount: 5000,
      };
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      prisma.insuranceClaim.update.mockResolvedValue(updatedClaim);

      const result = await service.reviewClaim(claimId, adminId, {
        status: 'APPROVED',
        approvedAmount: 5000,
      });

      expect(result.status).toBe(ClaimStatus.APPROVED);
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Insurance Claim Approved' }),
      );
    });

    it('should throw BadRequestException when rejecting without a reason', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      await expect(
        service.reviewClaim(claimId, adminId, { status: 'REJECTED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a PENDING claim with a reason', async () => {
      const rejectedClaim = {
        ...mockClaim,
        status: ClaimStatus.REJECTED,
        rejectionReason: 'Not covered',
      };
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      prisma.insuranceClaim.update.mockResolvedValue(rejectedClaim);

      const result = await service.reviewClaim(claimId, adminId, {
        status: 'REJECTED',
        rejectionReason: 'Not covered',
      });

      expect(result.status).toBe(ClaimStatus.REJECTED);
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Insurance Claim Rejected' }),
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  processPayout
   * ───────────────────────────────────────────────────────────────── */
  describe('processPayout', () => {
    it('should throw NotFoundException when claim does not exist', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(null);
      await expect(service.processPayout(claimId, adminId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when claim is not in APPROVED status', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue({
        ...mockClaim,
        status: ClaimStatus.PENDING,
      });
      await expect(service.processPayout(claimId, adminId)).rejects.toThrow(BadRequestException);
    });

    it('should move claim APPROVED → PROCESSING → PAID and send multi-channel notification', async () => {
      const approvedClaim = {
        ...mockClaim,
        status: ClaimStatus.APPROVED,
        approvedAmount: 5000,
      };
      const paidClaim = { ...approvedClaim, status: ClaimStatus.PAID };
      prisma.insuranceClaim.findUnique.mockResolvedValue(approvedClaim);
      prisma.insuranceClaim.update
        .mockResolvedValueOnce({ ...approvedClaim, status: ClaimStatus.PROCESSING })
        .mockResolvedValueOnce(paidClaim);

      const result = await service.processPayout(claimId, adminId);

      expect(prisma.insuranceClaim.update).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(notificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Insurance Claim Paid',
          channels: expect.arrayContaining(['EMAIL', 'IN_APP', 'PUSH']),
        }),
      );
      expect(result.status).toBe(ClaimStatus.PAID);
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  cancelClaim
   * ───────────────────────────────────────────────────────────────── */
  describe('cancelClaim', () => {
    it('should throw NotFoundException when claim does not exist', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(null);
      await expect(service.cancelClaim(claimId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the claim', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      await expect(service.cancelClaim(claimId, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when claim is not in PENDING status', async () => {
      prisma.insuranceClaim.findUnique.mockResolvedValue({
        ...mockClaim,
        status: ClaimStatus.APPROVED,
      });
      await expect(service.cancelClaim(claimId, userId)).rejects.toThrow(BadRequestException);
    });

    it('should cancel a PENDING claim successfully', async () => {
      const cancelledClaim = { ...mockClaim, status: ClaimStatus.CANCELLED };
      prisma.insuranceClaim.findUnique.mockResolvedValue(mockClaim);
      prisma.insuranceClaim.update.mockResolvedValue(cancelledClaim);

      const result = await service.cancelClaim(claimId, userId);
      expect(result.status).toBe(ClaimStatus.CANCELLED);
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  getClaimStats
   * ───────────────────────────────────────────────────────────────── */
  describe('getClaimStats', () => {
    it('should return status counts, total paid amount, and total reviewed claims', async () => {
      prisma.insuranceClaim.groupBy.mockResolvedValue([
        { status: ClaimStatus.PENDING, _count: { id: 3 } },
        { status: ClaimStatus.PAID, _count: { id: 2 } },
      ]);
      prisma.insuranceClaim.aggregate
        .mockResolvedValueOnce({ _sum: { approvedAmount: 10000 } }) // totalAmount
        .mockResolvedValueOnce({ _count: { id: 5 } }); // avgProcessingTime

      const result = await service.getClaimStats();

      expect(result.byStatus[ClaimStatus.PENDING]).toBe(3);
      expect(result.byStatus[ClaimStatus.PAID]).toBe(2);
      expect(result.totalPaidAmount).toBe(10000);
      expect(result.totalReviewedClaims).toBe(5);
    });

    it('should return 0 for totalPaidAmount when no paid claims exist', async () => {
      prisma.insuranceClaim.groupBy.mockResolvedValue([]);
      prisma.insuranceClaim.aggregate
        .mockResolvedValueOnce({ _sum: { approvedAmount: null } })
        .mockResolvedValueOnce({ _count: { id: 0 } });

      const result = await service.getClaimStats();
      expect(result.totalPaidAmount).toBe(0);
    });
  });
});
