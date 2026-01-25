import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InsuranceService, InsuranceStatus } from './insurance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InsuranceVerificationService } from './insurance-verification.service';
import { InsurancePolicyService } from './insurance-policy.service';

describe('InsuranceService', () => {
  let service: InsuranceService;
  let prismaService: any;
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
            queueVerification: jest.fn(),
          },
        },
        {
          provide: InsurancePolicyService,
          useValue: {
            createPolicy: jest.fn(),
            updatePolicy: jest.fn(),
            getPoliciesByUser: jest.fn(),
            getPoliciesByListing: jest.fn(),
            updatePolicyStatus: jest.fn(),
            getPolicy: jest.fn(),
            getActivePolicy: jest.fn(),
            getExpiringPolicies: jest.fn(),
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
        basePrice: 600,
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
        basePrice: 50,
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

  describe('uploadInsurancePolicy', () => {
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
        basePrice: 600,
        category: { name: 'Vehicles' },
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);
      policyService.createPolicy.mockResolvedValue({
        id: 'policy-789',
        ...mockPolicyData,
        status: InsuranceStatus.PENDING,
      } as any);

      const result = await service.uploadInsurancePolicy(mockPolicyData);

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
        basePrice: 600,
        category: { name: 'Vehicles' },
      };

      const insufficientPolicyData = {
        ...mockPolicyData,
        coverageAmount: 500, // Too low
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      await expect(service.uploadInsurancePolicy(insufficientPolicyData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject expired policy', async () => {
      const mockListing = {
        id: 'listing-456',
        basePrice: 600,
        category: { name: 'Vehicles' },
      };

      const expiredPolicyData = {
        ...mockPolicyData,
        expirationDate: new Date('2025-01-01'), // Expired
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      await expect(service.uploadInsurancePolicy(expiredPolicyData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate effective date is before expiration date', async () => {
      const mockListing = {
        id: 'listing-456',
        basePrice: 600,
        category: { name: 'Vehicles' },
      };

      const invalidPolicyData = {
        ...mockPolicyData,
        effectiveDate: new Date('2026-12-31'),
        expirationDate: new Date('2026-01-01'), // Before effective date
      };

      prismaService.listing.findUnique.mockResolvedValue(mockListing as any);

      await expect(service.uploadInsurancePolicy(invalidPolicyData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyInsurancePolicy', () => {
    it('should verify policy successfully', async () => {
      const mockPolicy = {
        id: 'policy-123',
        status: InsuranceStatus.PENDING,
        coverageAmount: 100000,
        expirationDate: new Date('2026-12-31'),
        listingId: 'listing-456',
      };

      policyService.getPolicy.mockResolvedValue(mockPolicy as any);
      policyService.updatePolicyStatus.mockResolvedValue({
        ...mockPolicy,
        status: InsuranceStatus.VERIFIED,
      } as any);

      // We expect no return (void)
      await service.verifyInsurancePolicy('policy-123', 'admin-456', true);

      expect(policyService.updatePolicyStatus).toHaveBeenCalledWith(
        'policy-123',
        InsuranceStatus.VERIFIED,
        expect.objectContaining({
          verifiedBy: 'admin-456',
        }),
      );
    });

    it('should reject policy with notes', async () => {
      const mockPolicy = {
        id: 'policy-123',
        status: InsuranceStatus.PENDING,
        listingId: 'listing-456',
      };

      policyService.getPolicy.mockResolvedValue(mockPolicy as any);
      policyService.updatePolicyStatus.mockResolvedValue({
        ...mockPolicy,
        status: InsuranceStatus.REJECTED,
      } as any);

      await service.verifyInsurancePolicy(
        'policy-123',
        'admin-456',
        false,
        'Invalid coverage amount',
      );

      expect(policyService.updatePolicyStatus).toHaveBeenCalledWith(
        'policy-123',
        InsuranceStatus.REJECTED,
        expect.objectContaining({
          verifiedBy: 'admin-456',
          notes: 'Invalid coverage amount',
        }),
      );
    });
  });

  describe('getExpiringPolicies', () => {
    it('should identify policies expiring soon', async () => {
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + 14); // Expected date passed to service

      const mockPolicies = [
        {
          id: 'policy-1',
          expirationDate: expiringDate,
          status: InsuranceStatus.VERIFIED,
          user: { id: 'user-123', email: 'user@example.com' },
        },
      ];

      policyService.getExpiringPolicies.mockResolvedValue(mockPolicies as any);

      const result = await service.getExpiringPolicies(14); // 14 days threshold

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('policy-1');
      // Verify called with approximately the right date (ignoring milliseconds)
      const callArg = policyService.getExpiringPolicies.mock.calls[0][0];
      expect(callArg.getDate()).toBe(expiringDate.getDate());
      expect(callArg.getMonth()).toBe(expiringDate.getMonth());
    });
  });
  /*
  // TODO: Move these tests to insurance-policy.service.spec.ts
  describe('getPoliciesByUser', ...);
  describe('renewPolicy', ...);
  */
});
