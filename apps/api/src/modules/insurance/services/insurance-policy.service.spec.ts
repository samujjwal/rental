import { InsurancePolicyService } from './insurance-policy.service';

describe('InsurancePolicyService', () => {
  let service: InsurancePolicyService;
  let prisma: any;

  const mockPolicy = {
    id: 'policy-1',
    propertyId: 'listing-1',
    userId: 'user-1',
    provider: 'Sagarmatha Insurance',
    policyNumber: 'POL-12345',
    coverageAmount: 100000,
    status: 'ACTIVE',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    documents: ['https://example.com/doc.pdf'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      insurancePolicy: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    service = new InsurancePolicyService(prisma, { get: jest.fn().mockReturnValue('USD') } as any);
  });

  describe('createPolicy', () => {
    it('should create a new insurance policy with mapped fields', async () => {
      prisma.insurancePolicy.create.mockResolvedValue(mockPolicy);

      const result = await service.createPolicy({
        listingId: 'listing-1',
        userId: 'user-1',
        provider: 'Sagarmatha Insurance',
        policyNumber: 'POL-12345',
        coverageAmount: 100000,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        documentUrl: 'https://example.com/doc.pdf',
      } as any);

      expect(prisma.insurancePolicy.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should default status to ACTIVE', async () => {
      prisma.insurancePolicy.create.mockResolvedValue({ ...mockPolicy, status: 'ACTIVE' });

      const result = await service.createPolicy({
        listingId: 'listing-1',
        userId: 'user-1',
      } as any);

      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('getPolicy', () => {
    it('should return policy when found', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(mockPolicy);

      const result = await service.getPolicy('policy-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('policy-1');
    });

    it('should return null when not found', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(null);

      const result = await service.getPolicy('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getActivePolicy', () => {
    it('should return active policy for listing', async () => {
      prisma.insurancePolicy.findFirst.mockResolvedValue(mockPolicy);

      const result = await service.getActivePolicy('listing-1');

      expect(result).toBeDefined();
      expect(prisma.insurancePolicy.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should return null when no active policy exists', async () => {
      prisma.insurancePolicy.findFirst.mockResolvedValue(null);

      const result = await service.getActivePolicy('listing-1');

      expect(result).toBeNull();
    });
  });

  describe('updatePolicyStatus', () => {
    it('should update policy status', async () => {
      prisma.insurancePolicy.update.mockResolvedValue({ ...mockPolicy, status: 'EXPIRED' });

      await service.updatePolicyStatus('policy-1', 'EXPIRED' as any);

      expect(prisma.insurancePolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'policy-1' },
        }),
      );
    });

    it('should create audit log when metadata provided', async () => {
      prisma.insurancePolicy.update.mockResolvedValue({ ...mockPolicy, status: 'CANCELLED' });

      await service.updatePolicyStatus('policy-1', 'CANCELLED' as any, {
        reason: 'User requested cancellation',
      });

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should not create audit log when no metadata', async () => {
      prisma.insurancePolicy.update.mockResolvedValue({ ...mockPolicy, status: 'EXPIRED' });

      await service.updatePolicyStatus('policy-1', 'EXPIRED' as any);

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getExpiringPolicies', () => {
    it('should return policies expiring before given date', async () => {
      prisma.insurancePolicy.findMany.mockResolvedValue([mockPolicy]);

      const result = await service.getExpiringPolicies(new Date('2026-01-01'));

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no expiring policies', async () => {
      prisma.insurancePolicy.findMany.mockResolvedValue([]);

      const result = await service.getExpiringPolicies(new Date('2024-01-01'));

      expect(result).toEqual([]);
    });
  });

  describe('getUserPolicies', () => {
    it('should return all policies for a user ordered by createdAt desc', async () => {
      prisma.insurancePolicy.findMany.mockResolvedValue([mockPolicy]);

      const result = await service.getUserPolicies('user-1');

      expect(Array.isArray(result)).toBe(true);
      expect(prisma.insurancePolicy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
          orderBy: expect.objectContaining({ createdAt: 'desc' }),
        }),
      );
    });

    it('should return empty array for user with no policies', async () => {
      prisma.insurancePolicy.findMany.mockResolvedValue([]);

      const result = await service.getUserPolicies('user-no-policies');

      expect(result).toEqual([]);
    });
  });
});
