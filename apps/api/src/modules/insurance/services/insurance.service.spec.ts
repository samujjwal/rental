import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InsuranceService, InsuranceStatus } from './insurance.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { InsuranceVerificationService } from './insurance-verification.service';
import { InsurancePolicyService } from './insurance-policy.service';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let prismaService: jest.Mocked<PrismaService>;
  let verificationService: jest.Mocked<InsuranceVerificationService>;
  let policyService: jest.Mocked<InsurancePolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceService,
        {
          provide: PrismaService,
          useValue: {
            listing: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            insurancePolicy: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: InsuranceVerificationService,
          useValue: {
            verifyPolicy: jest.fn(),
            checkExpiration: jest.fn(),
          },
        },
        {
          provide: InsurancePolicyService,
          useValue: {
            createPolicy: jest.fn(),
            updatePolicy: jest.fn(),
            getPoliciesByUser: jest.fn(),
            getPoliciesByListing: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InsuranceService>(InsuranceService);
    prismaService = module.get(PrismaService);
    verificationService = module.get(InsuranceVerificationService);
    policyService = module.get(InsurancePolicyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkInsuranceRequirement', () => {
    it('should require insurance for high-value items', async () => {
      const mockListing = {
        id: 'listing-123',
        pricePerDay: 600,
        category: {
          name: 'Electronics',
        },
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await service.checkInsuranceRequirement('listing-123');

      expect(result.required).toBe(true);
      expect(result.minimumCoverage).toBeGreaterThanOrEqual(1200); // At least 2x daily rate
    });

    it('should not require insurance for low-value items', async () => {
      const mockListing = {
        id: 'listing-123',
        pricePerDay: 50,
        category: {
          name: 'Books',
        },
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await service.checkInsuranceRequirement('listing-123');

      expect(result.required).toBe(false);
    });

    it('should require insurance for vehicles category', async () => {
      const mockListing = {
        id: 'listing-123',
        pricePerDay: 100,
        category: {
          name: 'Vehicles',
        },
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await service.checkInsuranceRequirement('listing-123');

      expect(result.required).toBe(true);
      expect(result.type).toBe('COMPREHENSIVE');
    });

    it('should require insurance for heavy equipment', async () => {
      const mockListing = {
        id: 'listing-123',
        pricePerDay: 250,
        category: {
          name: 'Heavy Equipment',
        },
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      const result = await service.checkInsuranceRequirement('listing-123');

      expect(result.required).toBe(true);
      expect(result.type).toBe('LIABILITY');
    });

    it('should throw error for non-existent listing', async () => {
      prismaService.listing.findUnique.mockResolvedValue(null);

      await expect(service.checkInsuranceRequirement('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submitPolicy', () => {
    const mockPolicyData = {
      userId: 'user-123',
      listingId: 'listing-456',
      policyNumber: 'POL-123456',
      provider: 'State Farm',
      type: 'LIABILITY',
      coverageAmount: 100000,
      effectiveDate: new Date('2026-01-01'),
      expirationDate: new Date('2026-12-31'),
      documentUrl: 'https://example.com/policy.pdf',
    };

    it('should submit policy for verification', async () => {
      const mockListing = {
        id: 'listing-456',
        pricePerDay: 600,
        category: { name: 'Vehicles' },
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);
      policyService.createPolicy.mockResolvedValue({
        id: 'policy-789',
        ...mockPolicyData,
        status: InsuranceStatus.PENDING,
      } as any);

      const result = await service.submitPolicy(mockPolicyData);

      expect(result.status).toBe(InsuranceStatus.PENDING);
      expect(policyService.createPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockPolicyData,
          status: InsuranceStatus.PENDING,
        }),
      );
    });

    it('should reject policy with insufficient coverage', async () => {
      const mockListing = {
        id: 'listing-456',
        pricePerDay: 600,
        category: { name: 'Vehicles' },
      };

      const insufficientPolicyData = {
        ...mockPolicyData,
        coverageAmount: 500, // Too low
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      await expect(service.submitPolicy(insufficientPolicyData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject expired policy', async () => {
      const mockListing = {
        id: 'listing-456',
        pricePerDay: 600,
        category: { name: 'Vehicles' },
      };

      const expiredPolicyData = {
        ...mockPolicyData,
        expirationDate: new Date('2025-01-01'), // Expired
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      await expect(service.submitPolicy(expiredPolicyData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate effective date is before expiration date', async () => {
      const mockListing = {
        id: 'listing-456',
        pricePerDay: 600,
        category: { name: 'Vehicles' },
      };

      const invalidPolicyData = {
        ...mockPolicyData,
        effectiveDate: new Date('2026-12-31'),
        expirationDate: new Date('2026-01-01'), // Before effective date
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      await expect(service.submitPolicy(invalidPolicyData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyPolicy', () => {
    it('should verify policy successfully', async () => {
      const mockPolicy = {
        id: 'policy-123',
        status: InsuranceStatus.PENDING,
        coverageAmount: 100000,
        expirationDate: new Date('2026-12-31'),
      };

      prismaService.insurancePolicy.findUnique.mockResolvedValue(mockPolicy as any);
      verificationService.verifyPolicy.mockResolvedValue({
        verified: true,
        confidence: 0.95,
      } as any);
      policyService.updatePolicy.mockResolvedValue({
        ...mockPolicy,
        status: InsuranceStatus.VERIFIED,
      } as any);

      const result = await service.verifyPolicy('policy-123', 'admin-456', 'Verified');

      expect(result.status).toBe(InsuranceStatus.VERIFIED);
      expect(policyService.updatePolicy).toHaveBeenCalledWith(
        'policy-123',
        expect.objectContaining({
          status: InsuranceStatus.VERIFIED,
          verifiedBy: 'admin-456',
        }),
      );
    });

    it('should reject policy with notes', async () => {
      const mockPolicy = {
        id: 'policy-123',
        status: InsuranceStatus.PENDING,
      };

      prismaService.insurancePolicy.findUnique.mockResolvedValue(mockPolicy as any);
      policyService.updatePolicy.mockResolvedValue({
        ...mockPolicy,
        status: InsuranceStatus.REJECTED,
      } as any);

      const result = await service.rejectPolicy(
        'policy-123',
        'admin-456',
        'Invalid coverage amount',
      );

      expect(result.status).toBe(InsuranceStatus.REJECTED);
      expect(policyService.updatePolicy).toHaveBeenCalledWith(
        'policy-123',
        expect.objectContaining({
          status: InsuranceStatus.REJECTED,
          notes: 'Invalid coverage amount',
        }),
      );
    });
  });

  describe('getPoliciesByUser', () => {
    it('should return all user policies', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          userId: 'user-123',
          status: InsuranceStatus.VERIFIED,
        },
        {
          id: 'policy-2',
          userId: 'user-123',
          status: InsuranceStatus.PENDING,
        },
      ];

      policyService.getPoliciesByUser.mockResolvedValue(mockPolicies as any);

      const result = await service.getPoliciesByUser('user-123');

      expect(result).toEqual(mockPolicies);
      expect(policyService.getPoliciesByUser).toHaveBeenCalledWith('user-123');
    });

    it('should filter policies by status', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          userId: 'user-123',
          status: InsuranceStatus.VERIFIED,
        },
      ];

      policyService.getPoliciesByUser.mockResolvedValue(mockPolicies as any);

      const result = await service.getPoliciesByUser('user-123', {
        status: InsuranceStatus.VERIFIED,
      });

      expect(result).toEqual(mockPolicies);
    });
  });

  describe('checkExpiringPolicies', () => {
    it('should identify policies expiring soon', async () => {
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + 10); // Expires in 10 days

      const mockPolicies = [
        {
          id: 'policy-1',
          expirationDate: expiringDate,
          status: InsuranceStatus.VERIFIED,
          user: { id: 'user-123', email: 'user@example.com' },
        },
      ];

      prismaService.insurancePolicy.findMany.mockResolvedValue(mockPolicies as any);

      const result = await service.checkExpiringPolicies(14); // 14 days threshold

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('policy-1');
    });

    it('should not include already expired policies', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1); // Expired yesterday

      const mockPolicies = [
        {
          id: 'policy-1',
          expirationDate: expiredDate,
          status: InsuranceStatus.EXPIRED,
        },
      ];

      prismaService.insurancePolicy.findMany.mockResolvedValue(mockPolicies as any);

      const result = await service.checkExpiringPolicies(14);

      expect(result).toHaveLength(0);
    });
  });

  describe('renewPolicy', () => {
    it('should renew policy with new expiration date', async () => {
      const mockPolicy = {
        id: 'policy-123',
        expirationDate: new Date('2026-12-31'),
        status: InsuranceStatus.VERIFIED,
      };

      const newExpirationDate = new Date('2027-12-31');

      prismaService.insurancePolicy.findUnique.mockResolvedValue(mockPolicy as any);
      policyService.updatePolicy.mockResolvedValue({
        ...mockPolicy,
        expirationDate: newExpirationDate,
      } as any);

      const result = await service.renewPolicy('policy-123', newExpirationDate);

      expect(result.expirationDate).toEqual(newExpirationDate);
      expect(policyService.updatePolicy).toHaveBeenCalledWith(
        'policy-123',
        expect.objectContaining({
          expirationDate: newExpirationDate,
        }),
      );
    });

    it('should not allow renewal with past date', async () => {
      const mockPolicy = {
        id: 'policy-123',
        expirationDate: new Date('2026-12-31'),
      };

      const pastDate = new Date('2025-01-01');

      prismaService.insurancePolicy.findUnique.mockResolvedValue(mockPolicy as any);

      await expect(service.renewPolicy('policy-123', pastDate)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
