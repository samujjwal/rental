import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from '@/common/encryption/field-encryption.service';
import { UsersService } from '@/modules/users/services/users.service';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { AuditService } from '@/common/audit/audit.service';
import { UserStatus, UserRole, VerificationStatus } from '@rental-portal/database';

/**
 * KYC Verification Complete Flow Tests
 * 
 * These tests validate the complete KYC verification process including
 * document upload, validation, fraud detection, and compliance workflows.
 */
describe('KYC Verification Complete Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cache: CacheService;
  let usersService: UsersService;
  let notificationsService: NotificationsService;
  let auditService: AuditService;
  let encryption: FieldEncryptionService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    phone: '+1234567890',
    bio: 'Test user bio',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isActive: true,
    averageRating: 4.5,
    totalReviews: 10,
    responseRate: 95,
    responseTime: '1 hour',
    stripeCustomerId: 'cus_test',
    stripeConnectId: 'acct_test',
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    verificationStatus: VerificationStatus.PENDING,
    verificationDocuments: [],
    loginAttempts: 0,
    lockedUntil: null,
    googleId: null,
    appleId: null,
    subscriptionStatus: null,
    subscriptionId: null,
    subscriptionPlan: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(null),
      },
      verificationDocument: {
        create: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      kycVerification: {
        create: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(null),
    };

    const mockEncryption = {
      encrypt: jest.fn().mockResolvedValue('encrypted_data'),
      decrypt: jest.fn().mockResolvedValue('decrypted_data'),
    };

    const mockNotifications = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendSMS: jest.fn().mockResolvedValue(true),
      createNotification: jest.fn().mockResolvedValue(null),
    };

    const mockAudit = {
      logAction: jest.fn().mockResolvedValue(null),
      getAuditTrail: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: FieldEncryptionService, useValue: mockEncryption },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    auditService = module.get<AuditService>(AuditService);
    encryption = module.get<FieldEncryptionService>(FieldEncryptionService);
  });

  describe('Document Upload Process', () => {
    it('should validate document formats and sizes', async () => {
      const validDocument = {
        type: 'passport',
        format: 'pdf',
        size: 2048000, // 2MB
        data: Buffer.from('pdf_document_data'),
      };

      const invalidFormats = [
        { type: 'passport', format: 'exe', size: 1000000 },
        { type: 'id_card', format: 'txt', size: 500000 },
        { type: 'driver_license', format: 'zip', size: 3000000 },
      ];

      // Test valid document
      const isValid = await usersService.validateDocument(validDocument);
      expect(isValid).toBe(true);

      // Test invalid formats
      for (const invalidDoc of invalidFormats) {
        const isInvalid = await usersService.validateDocument(invalidDoc);
        expect(isInvalid).toBe(false);
      }

      // Test size limits
      const oversizedDoc = {
        type: 'passport',
        format: 'pdf',
        size: 10485760, // 10MB - too large
        data: Buffer.from('large_document_data'),
      };

      const isOversized = await usersService.validateDocument(oversizedDoc);
      expect(isOversized).toBe(false);
    });

    it('should extract document metadata correctly', async () => {
      const documentWithMetadata = {
        type: 'passport',
        format: 'pdf',
        size: 2048000,
        data: Buffer.from('pdf_with_metadata'),
        metadata: {
          pageNumber: 1,
          creationDate: '2020-01-01',
          author: 'Government Agency',
          title: 'Passport Document',
        },
      };

      (prisma.verificationDocument.create as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        userId: mockUser.id,
        type: documentWithMetadata.type,
        status: 'uploaded',
        metadata: documentWithMetadata.metadata,
        createdAt: new Date(),
      });

      const result = await usersService.uploadVerificationDocument(
        mockUser.id,
        documentWithMetadata
      );

      expect(result).toBeDefined();
      expect(result.type).toBe(documentWithMetadata.type);
      expect(result.metadata).toEqual(documentWithMetadata.metadata);
      expect(prisma.verificationDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          type: documentWithMetadata.type,
          metadata: documentWithMetadata.metadata,
        }),
      });
    });

    it('should detect fraudulent documents', async () => {
      const suspiciousDocuments = [
        {
          type: 'passport',
          format: 'pdf',
          size: 2048000,
          data: Buffer.from('manipulated_pdf'),
          riskFactors: ['digital_alteration', 'template_mismatch'],
        },
        {
          type: 'id_card',
          format: 'jpg',
          size: 1024000,
          data: Buffer.from('photoshopped_id'),
          riskFactors: ['photo_manipulation', 'font_inconsistency'],
        },
      ];

      for (const suspiciousDoc of suspiciousDocuments) {
        const fraudCheck = await usersService.detectFraud(suspiciousDoc);
        expect(fraudCheck.isSuspicious).toBe(true);
        expect(fraudCheck.riskFactors.length).toBeGreaterThan(0);
        expect(fraudCheck.confidence).toBeGreaterThan(0.7);
      }

      // Test legitimate document
      const legitimateDoc = {
        type: 'passport',
        format: 'pdf',
        size: 2048000,
        data: Buffer.from('legitimate_passport'),
        riskFactors: [],
      };

      const legitCheck = await usersService.detectFraud(legitimateDoc);
      expect(legitCheck.isSuspicious).toBe(false);
      expect(legitCheck.riskFactors).toEqual([]);
    });
  });

  describe('Verification Workflow', () => {
    it('should route documents to correct verifiers', async () => {
      const documentTypes = [
        { type: 'passport', expectedVerifier: 'government_id_specialist' },
        { type: 'driver_license', expectedVerifier: 'dl_specialist' },
        { type: 'id_card', expectedVerifier: 'id_card_specialist' },
        { type: 'utility_bill', expectedVerifier: 'address_specialist' },
        { type: 'bank_statement', expectedVerifier: 'financial_specialist' },
      ];

      for (const docType of documentTypes) {
        const routing = await usersService.routeDocument(docType.type);
        expect(routing.assignedVerifier).toBe(docType.expectedVerifier);
        expect(routing.priority).toBeDefined();
        expect(routing.estimatedProcessingTime).toBeDefined();
      }
    });

    it('should handle verification retries', async () => {
      const verificationAttempt = {
        documentId: 'doc-1',
        userId: mockUser.id,
        attempts: 0,
        maxRetries: 3,
        retryDelay: 3600, // 1 hour
      };

      // First attempt fails
      (prisma.kycVerification.update as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        status: 'failed',
        attempt: 1,
        nextRetryAt: new Date(Date.now() + 3600000),
      });

      const firstResult = await usersService.processVerification(verificationAttempt);
      expect(firstResult.status).toBe('failed');
      expect(firstResult.canRetry).toBe(true);
      expect(firstResult.nextRetryAt).toBeDefined();

      // Second attempt also fails
      verificationAttempt.attempts = 1;
      (prisma.kycVerification.update as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        status: 'failed',
        attempt: 2,
        nextRetryAt: new Date(Date.now() + 7200000), // 2 hours
      });

      const secondResult = await usersService.processVerification(verificationAttempt);
      expect(secondResult.status).toBe('failed');
      expect(secondResult.canRetry).toBe(true);
      expect(secondResult.retryDelay).toBe(7200); // 2 hours

      // Third attempt exhausts retries
      verificationAttempt.attempts = 2;
      (prisma.kycVerification.update as jest.Mock).mockResolvedValue({
        id: 'ver-1',
        status: 'permanently_failed',
        attempt: 3,
        nextRetryAt: null,
      });

      const thirdResult = await usersService.processVerification(verificationAttempt);
      expect(thirdResult.status).toBe('permanently_failed');
      expect(thirdResult.canRetry).toBe(false);
    });

    it('should maintain audit trail', async () => {
      const auditEvents = [
        {
          action: 'document_uploaded',
          userId: mockUser.id,
          documentId: 'doc-1',
          timestamp: new Date(),
          metadata: { documentType: 'passport' },
        },
        {
          action: 'verification_started',
          userId: mockUser.id,
          verificationId: 'ver-1',
          timestamp: new Date(),
          metadata: { assignedVerifier: 'government_id_specialist' },
        },
        {
          action: 'verification_completed',
          userId: mockUser.id,
          verificationId: 'ver-1',
          timestamp: new Date(),
          metadata: { status: 'approved', score: 0.95 },
        },
      ];

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      for (const event of auditEvents) {
        await auditService.logAction(event.action, event.userId, event.metadata);
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: event.action,
            userId: event.userId,
            metadata: event.metadata,
          }),
        });
      }

      // Verify audit trail retrieval
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(auditEvents);
      const auditTrail = await auditService.getAuditTrail(mockUser.id);

      expect(auditTrail).toHaveLength(3);
      expect(auditTrail[0].action).toBe('document_uploaded');
      expect(auditTrail[2].action).toBe('verification_completed');
    });
  });

  describe('Compliance Validation', () => {
    it('should enforce age restrictions', async () => {
      const underAgeUser = {
        ...mockUser,
        dateOfBirth: new Date(Date.now() - 17 * 365 * 24 * 60 * 60 * 1000), // 17 years old
      };

      const ageCheck = await usersService.validateAgeRequirement(underAgeUser);
      expect(ageCheck.isValid).toBe(false);
      expect(ageCheck.reason).toBe('user_under_minimum_age');

      const validAgeUser = {
        ...mockUser,
        dateOfBirth: new Date(Date.now() - 25 * 365 * 24 * 60 * 60 * 1000), // 25 years old
      };

      const validAgeCheck = await usersService.validateAgeRequirement(validAgeUser);
      expect(validAgeCheck.isValid).toBe(true);
    });

    it('should validate document expiration', async () => {
      const expiredDocument = {
        id: 'doc-1',
        type: 'passport',
        expirationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        issuedDate: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000), // 10 years ago
      };

      const expirationCheck = await usersService.validateDocumentExpiration(expiredDocument);
      expect(expirationCheck.isValid).toBe(false);
      expect(expirationCheck.reason).toBe('document_expired');

      const validDocument = {
        id: 'doc-2',
        type: 'passport',
        expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
        issuedDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago
      };

      const validExpirationCheck = await usersService.validateDocumentExpiration(validDocument);
      expect(validExpirationCheck.isValid).toBe(true);
    });

    it('should check for duplicate verifications', async () => {
      const existingVerifications = [
        {
          id: 'ver-1',
          userId: mockUser.id,
          status: 'approved',
          documentType: 'passport',
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ];

      (prisma.kycVerification.findMany as jest.Mock).mockResolvedValue(existingVerifications);

      const duplicateCheck = await usersService.checkDuplicateVerification(
        mockUser.id,
        'passport'
      );
      expect(duplicateCheck.hasDuplicate).toBe(true);
      expect(duplicateCheck.existingVerificationId).toBe('ver-1');

      // Check for different document type
      const differentTypeCheck = await usersService.checkDuplicateVerification(
        mockUser.id,
        'driver_license'
      );
      expect(differentTypeCheck.hasDuplicate).toBe(false);
    });
  });

  describe('Security & Privacy', () => {
    it('should encrypt sensitive document data', async () => {
      const sensitiveData = {
        documentNumber: 'ABC123456',
        issuingAuthority: 'Department of State',
        personalIdentifiers: 'sensitive_info',
      };

      (encryption.encrypt as jest.Mock).mockResolvedValue('encrypted_sensitive_data');

      const encryptedData = await usersService.encryptSensitiveData(sensitiveData);
      expect(encryptedData).toBe('encrypted_sensitive_data');
      expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify(sensitiveData));
    });

    it('should securely delete documents after retention period', async () => {
      const oldDocuments = [
        {
          id: 'doc-1',
          userId: mockUser.id,
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days old
          data: Buffer.from('document_data'),
        },
        {
          id: 'doc-2',
          userId: mockUser.id,
          createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days old
          data: Buffer.from('document_data'),
        },
      ];

      (prisma.verificationDocument.findMany as jest.Mock).mockResolvedValue(oldDocuments);
      (prisma.verificationDocument.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const deletionResult = await usersService.cleanupExpiredDocuments();
      expect(deletionResult.deletedCount).toBe(1); // Only the 400-day-old document
      expect(prisma.verificationDocument.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'doc-1',
        },
      });
    });

    it('should maintain data privacy during verification', async () => {
      const privacySettings = {
        shareDataWithThirdParties: false,
        allowDataProcessing: true,
        retentionPeriod: 365,
        dataAnonymization: true,
      };

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        privacySettings,
      });

      const result = await usersService.updatePrivacySettings(mockUser.id, privacySettings);
      expect(result.privacySettings).toEqual(privacySettings);
      expect(auditService.logAction).toHaveBeenCalledWith(
        'privacy_settings_updated',
        mockUser.id,
        expect.any(Object)
      );
    });
  });

  describe('Integration with External Services', () => {
    it('should integrate with identity verification services', async () => {
      const externalVerification = {
        provider: 'identity_service',
        verificationId: 'ext-ver-123',
        status: 'approved',
        score: 0.92,
        checks: ['document_authenticity', 'biometric_match', 'watchlist_screening'],
      };

      const integrationResult = await usersService.processExternalVerification(
        mockUser.id,
        externalVerification
      );

      expect(integrationResult.status).toBe('approved');
      expect(integrationResult.confidence).toBe(0.92);
      expect(prisma.kycVerification.update).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: expect.objectContaining({
          status: 'approved',
          externalVerificationId: externalVerification.verificationId,
          externalScore: externalVerification.score,
        }),
      });
    });

    it('should handle verification service outages', async () => {
      // Mock service outage
      jest.spyOn(usersService, 'callExternalVerificationService').mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await usersService.submitVerification(mockUser.id, {
        documentType: 'passport',
        documentData: Buffer.from('passport_data'),
      });

      expect(result.status).toBe('queued');
      expect(result.retryScheduled).toBe(true);
      expect(notificationsService.sendEmail).toHaveBeenCalledWith(
        mockUser.email,
        'verification_queued',
        expect.any(Object)
      );
    });
  });
});
