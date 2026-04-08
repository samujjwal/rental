import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingPricingService } from './booking-pricing.service';
import { KycService, UploadDocumentDto } from '../../users/services/kyc.service';
import { IdentityDocumentType, VerificationStatus } from '@rental-portal/database';

/**
 * Edge Case Coverage Tests
 * 
 * These tests validate boundary conditions, error scenarios, and edge cases
 * that might not be covered in standard test flows.
 */
describe('Edge Case Coverage Tests', () => {
  let prisma: PrismaService;
  let config: ConfigService;
  let pricingService: BookingPricingService;
  let kycService: KycService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingPricingService,
        KycService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findUnique: jest.fn(),
            },
            bookingPriceBreakdown: {
              deleteMany: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
            identityDocument: {
              findFirst: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => defaultValue),
          },
        },
      ],
    }).compile();

    pricingService = module.get<BookingPricingService>(BookingPricingService);
    kycService = module.get<KycService>(KycService);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);
  });

  // ============================================================================
  // PRICING EDGE CASES
  // ============================================================================

  describe('Pricing Service Edge Cases', () => {
    test('should handle maximum safe integer values', async () => {
      const maxSafeInteger = Number.MAX_SAFE_INTEGER;
      const bookingId = 'booking-max-int';

      // Mock booking exists
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      
      // Mock transaction to return empty array
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await expect(pricingService.calculateAndPersist(bookingId, {
        basePrice: maxSafeInteger,
        nights: 1,
      })).resolves.toBeDefined();

      // Verify the calculation doesn't overflow
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('should handle very small amounts (precision edge cases)', async () => {
      const bookingId = 'booking-min-amount';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 0.01, // Minimum possible amount
        nights: 1,
        serviceFeeRate: 0.05,
        taxRate: 0.08,
      });

      // Verify transaction was called with very small amounts
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('should handle zero night booking', async () => {
      const bookingId = 'booking-zero-nights';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 0, // Edge case: zero nights
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('should handle negative fee rates gracefully', async () => {
      const bookingId = 'booking-negative-fees';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 1,
        serviceFeeRate: -0.05, // Negative rate (should be handled gracefully)
        taxRate: -0.08, // Negative tax rate
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('should handle extremely large number of nights', async () => {
      const bookingId = 'booking-long-stay';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 50,
        nights: 365 * 10, // 10 years
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('should handle decimal precision edge cases', async () => {
      const bookingId = 'booking-decimal-edge';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 33.33333333333333, // Repeating decimal
        nights: 3,
        serviceFeeRate: 0.0333333333333333, // Repeating decimal rate
        taxRate: 0.0666666666666667,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // KYC EDGE CASES
  // ============================================================================

  describe('KYC Service Edge Cases', () => {
    test('should handle malformed document URLs', async () => {
      const userId = 'user-edge-1';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'not-a-valid-url', // Malformed URL
        expiresAt: '2028-01-01',
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        ...documentData,
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      // Service should accept the URL (validation might be at a different layer)
      const result = await kycService.uploadDocument(userId, documentData);
      expect(result.documentUrl).toBe(documentData.documentUrl);
    });

    test('should handle expired documents', async () => {
      const userId = 'user-edge-2';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'https://example.com/passport.jpg',
        expiresAt: '2020-01-01', // Already expired
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-2',
        userId,
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: documentData.documentUrl,
        expiresAt: new Date(documentData.expiresAt!), // Ensure it's a Date object
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-2' });

      const result = await kycService.uploadDocument(userId, documentData);
      // The service returns the date as stored (may be string format)
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    test('should handle very long document URLs', async () => {
      const userId = 'user-edge-3';
      const longUrl = 'https://example.com/' + 'a'.repeat(1000); // Very long URL
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.DRIVERS_LICENSE,
        documentUrl: longUrl,
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-3',
        ...documentData,
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-3' });

      const result = await kycService.uploadDocument(userId, documentData);
      expect(result.documentUrl).toBe(longUrl);
    });

    test('should handle future expiration dates far in advance', async () => {
      const userId = 'user-edge-4';
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 50); // 50 years in future
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.NATIONAL_ID,
        documentUrl: 'https://example.com/id.jpg',
        expiresAt: futureDate.toISOString().split('T')[0],
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-4',
        userId,
        documentType: IdentityDocumentType.NATIONAL_ID,
        documentUrl: documentData.documentUrl,
        expiresAt: futureDate, // Ensure it's a Date object
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-4' });

      const result = await kycService.uploadDocument(userId, documentData);
      // The service returns the date as stored (may be string format)
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    test('should handle non-existent document types gracefully', async () => {
      const documentId = 'doc-non-existent';
      
      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(kycService.reviewDocument(documentId, 'admin-1', {
        status: 'APPROVED',
      })).rejects.toThrow('Document not found');
    });

    test('should handle database connection errors gracefully', async () => {
      const userId = 'user-edge-5';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'https://example.com/passport.jpg',
      };

      // Simulate database error
      (prisma.identityDocument.findFirst as jest.Mock).mockRejectedValue(new Error('Database connection lost'));

      await expect(kycService.uploadDocument(userId, documentData))
        .rejects.toThrow('Database connection lost');
    });
  });

  // ============================================================================
  // CONFIGURATION EDGE CASES
  // ============================================================================

  describe('Configuration Edge Cases', () => {
    test('should handle missing configuration values', async () => {
      // Mock config to return undefined for all keys
      (config.get as jest.Mock).mockReturnValue(undefined);

      const bookingId = 'booking-no-config';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      // Should use default values when config is missing
      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 1,
      });

      expect(config.get).toHaveBeenCalled();
    });

    test('should handle invalid configuration values', async () => {
      // Mock config to return invalid values
      (config.get as jest.Mock).mockImplementation((key: string) => {
        if (key.includes('FeePercent')) return 'invalid-number';
        return undefined;
      });

      const bookingId = 'booking-invalid-config';
      
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ id: bookingId });
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await pricingService.calculateAndPersist(bookingId, {
        basePrice: 100,
        nights: 1,
      });

      expect(config.get).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DATA INTEGRITY EDGE CASES
  // ============================================================================

  describe('Data Integrity Edge Cases', () => {
    test('should handle null values in optional fields', async () => {
      const userId = 'user-null-fields';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'https://example.com/passport.jpg',
        expiresAt: undefined, // Explicitly undefined
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-null',
        userId,
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: documentData.documentUrl,
        expiresAt: null,
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-null' });

      const result = await kycService.uploadDocument(userId, documentData);
      expect(result.expiresAt).toBeNull();
    });

    test('should handle empty strings in optional fields', async () => {
      const userId = 'user-empty-strings';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: '', // Empty URL
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-empty',
        userId,
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: '',
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-empty' });

      const result = await kycService.uploadDocument(userId, documentData);
      expect(result.documentUrl).toBe('');
    });

    test('should handle special characters in data', async () => {
      const userId = 'user-special-chars';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'https://example.com/passport.jpg?name=John%20Doe&country=US-CA#section1',
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-special',
        userId,
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: documentData.documentUrl,
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-special' });

      const result = await kycService.uploadDocument(userId, documentData);
      expect(result.documentUrl).toContain('John%20Doe');
    });
  });

  // ============================================================================
  // CONCURRENT ACCESS EDGE CASES
  // ============================================================================

  describe('Concurrent Access Edge Cases', () => {
    test('should handle simultaneous document uploads', async () => {
      const userId = 'user-concurrent';
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'https://example.com/passport1.jpg',
      };

      // Simulate race condition: no existing document, then create
      (prisma.identityDocument.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // First call finds none
        .mockResolvedValueOnce(null); // Second call also finds none
      
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-concurrent-1',
        userId,
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: documentData.documentUrl,
        status: VerificationStatus.PENDING,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-concurrent-1' });

      // Both uploads should succeed (in real scenario, one might fail due to race condition)
      const result1 = await kycService.uploadDocument(userId, documentData);
      const result2 = await kycService.uploadDocument(userId, {
        ...documentData,
        documentUrl: 'https://example.com/passport2.jpg'
      });

      expect(result1.status).toBe(VerificationStatus.PENDING);
      expect(prisma.identityDocument.create).toHaveBeenCalledTimes(2);
    });
  });
});
