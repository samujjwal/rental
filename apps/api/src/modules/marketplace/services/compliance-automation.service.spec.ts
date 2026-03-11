import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceAutomationService } from './compliance-automation.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ComplianceAutomationService', () => {
  let service: ComplianceAutomationService;
  let prisma: any;

  const mockUser = {
    id: 'user-1',
    role: 'HOST',
    phone: '+977-9841234567',
    emailVerified: true,
    kycStatus: 'VERIFIED',
    identityDocuments: [{ type: 'ID_DOCUMENT', status: 'VERIFIED' }],
    listings: [{ id: 'listing-1', country: 'NP' }],
  };

  const mockListing = {
    id: 'listing-1',
    title: 'Beautiful Room in Kathmandu',
    description: 'A spacious room with mountain views, close to Thamel. Includes breakfast and WiFi.',
    basePrice: 2500,
    country: 'NP',
    status: 'ACTIVE',
    owner: { id: 'user-1', emailVerified: true },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        count: jest.fn().mockResolvedValue(0),
      },
      listing: {
        findUnique: jest.fn().mockResolvedValue(mockListing),
        findMany: jest.fn().mockResolvedValue([mockListing]),
        count: jest.fn().mockResolvedValue(50),
      },
      booking: {
        count: jest.fn().mockResolvedValue(100),
      },
      dispute: {
        count: jest.fn().mockResolvedValue(5),
      },
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'al-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceAutomationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ComplianceAutomationService>(ComplianceAutomationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkUserCompliance', () => {
    it('should pass for compliant user', async () => {
      const result = await service.checkUserCompliance('user-1');
      expect(result.compliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should flag unverified email', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });
      const result = await service.checkUserCompliance('user-1');
      expect(result.compliant).toBe(false);
      expect(result.issues).toContain('Email not verified');
    });

    it('should flag missing phone', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        phone: null,
      });
      const result = await service.checkUserCompliance('user-1');
      expect(result.compliant).toBe(false);
      expect(result.issues).toContain('Phone number not provided');
    });

    it('should throw for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.checkUserCompliance('bad-id')).rejects.toThrow();
    });
  });

  describe('checkListingCompliance', () => {
    it('should pass for compliant listing', async () => {
      const result = await service.checkListingCompliance('listing-1');
      expect(result.compliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should flag short title', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        ...mockListing,
        title: 'Hi',
      });
      const result = await service.checkListingCompliance('listing-1');
      expect(result.compliant).toBe(false);
      expect(result.issues.some((i: string) => i.includes('title too short'))).toBe(true);
    });

    it('should flag zero price', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        ...mockListing,
        basePrice: 0,
      });
      const result = await service.checkListingCompliance('listing-1');
      expect(result.compliant).toBe(false);
    });

    it('should throw for non-existent listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await expect(service.checkListingCompliance('bad-id')).rejects.toThrow();
    });
  });

  describe('generateAuditTrail', () => {
    it('should create an audit log entry', async () => {
      const result = await service.generateAuditTrail({
        entityType: 'USER',
        entityId: 'user-1',
        action: 'KYC_VERIFIED',
        performedBy: 'admin-1',
      });
      expect(result).toBeDefined();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for an entity', async () => {
      const result = await service.getAuditTrail('USER', 'user-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('checkDataRetention', () => {
    it('should return data retention metrics', async () => {
      const result = await service.checkDataRetention();
      expect(result).toBeDefined();
      expect(result.dataRetentionPeriodDays).toBeGreaterThan(0);
      expect(result.usersRequiringDeletion).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateRegulatoryReport', () => {
    it('should generate a report for a country', async () => {
      const result = await service.generateRegulatoryReport(
        'NP',
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
      expect(result).toBeDefined();
      expect(result.country).toBe('NP');
      expect(result.metrics.totalBookings).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });
  });
});
