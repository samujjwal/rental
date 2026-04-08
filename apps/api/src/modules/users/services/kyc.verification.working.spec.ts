import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { KycService, UploadDocumentDto, ReviewDocumentDto } from './kyc.service';
import { IdentityDocumentType, VerificationStatus, UserRole, UserStatus } from '@rental-portal/database';

/**
 * KYC Verification Flow Tests - Working Version
 * 
 * These tests validate the KYC verification process using the actual KycService methods
 * including document upload, validation, review, and compliance workflows.
 */
describe('KYC Verification Flow - Working', () => {
  let kycService: KycService;
  let prisma: PrismaService;
  let config: ConfigService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    idVerificationStatus: 'NOT_VERIFIED',
  };

  const mockAdmin = {
    id: 'admin-1',
    email: 'admin@example.com',
    username: 'adminuser',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: PrismaService,
          useValue: {
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

    kycService = module.get<KycService>(KycService);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);
  });

  // ============================================================================
  // DOCUMENT UPLOAD FLOW
  // ============================================================================

  describe('Document Upload Flow', () => {
    test('should upload identity document successfully', async () => {
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: 'https://example.com/passport.jpg',
        expiresAt: '2028-01-01',
      };

      const mockDocument = {
        id: 'doc-1',
        userId: mockUser.id,
        documentType: IdentityDocumentType.PASSPORT,
        documentUrl: documentData.documentUrl,
        expiresAt: new Date(documentData.expiresAt!),
        status: VerificationStatus.PENDING,
        createdAt: new Date(),
      };

      // Mock no existing document
      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      
      // Mock document creation
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue(mockDocument);
      
      // Mock audit log creation
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

      const result = await kycService.uploadDocument(mockUser.id, documentData);

      expect(result).toEqual(mockDocument);
      expect(prisma.identityDocument.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          documentType: IdentityDocumentType.PASSPORT,
          documentUrl: documentData.documentUrl,
          expiresAt: new Date(documentData.expiresAt!),
          status: VerificationStatus.PENDING,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          action: 'KYC_DOCUMENT_SUBMITTED',
          entityType: 'IdentityDocument',
          entityId: mockDocument.id,
          newValues: JSON.stringify({ 
            documentType: IdentityDocumentType.PASSPORT, 
            status: VerificationStatus.PENDING 
          }),
        },
      });
    });

    test('should reject duplicate pending document of same type', async () => {
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.DRIVERS_LICENSE,
        documentUrl: 'https://example.com/license.jpg',
      };

      const existingDocument = {
        id: 'existing-doc',
        userId: mockUser.id,
        documentType: IdentityDocumentType.DRIVERS_LICENSE,
        status: VerificationStatus.PENDING,
      };

      // Mock existing pending document
      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(existingDocument);

      await expect(kycService.uploadDocument(mockUser.id, documentData))
        .rejects.toThrow('You already have a pending document of this type. Please wait for review.');

      expect(prisma.identityDocument.create).not.toHaveBeenCalled();
    });

    test('should handle document without expiration date', async () => {
      const documentData: UploadDocumentDto = {
        documentType: IdentityDocumentType.NATIONAL_ID,
        documentUrl: 'https://example.com/national-id.jpg',
      };

      const mockDocument = {
        id: 'doc-2',
        userId: mockUser.id,
        documentType: IdentityDocumentType.NATIONAL_ID,
        documentUrl: documentData.documentUrl,
        expiresAt: null,
        status: VerificationStatus.PENDING,
        createdAt: new Date(),
      };

      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-2' });

      const result = await kycService.uploadDocument(mockUser.id, documentData);

      expect(result.expiresAt).toBeNull();
      expect(prisma.identityDocument.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          documentType: IdentityDocumentType.NATIONAL_ID,
          documentUrl: documentData.documentUrl,
          expiresAt: undefined,
          status: VerificationStatus.PENDING,
        },
      });
    });
  });

  // ============================================================================
  // DOCUMENT REVIEW FLOW
  // ============================================================================

  describe('Document Review Flow', () => {
    test('should approve document successfully', async () => {
      const documentId = 'doc-1';
      const reviewData: ReviewDocumentDto = {
        status: 'APPROVED',
      };

      const mockDocument = {
        id: documentId,
        userId: mockUser.id,
        documentType: IdentityDocumentType.PASSPORT,
        status: VerificationStatus.PENDING,
      };

      const updatedDocument = {
        ...mockDocument,
        status: VerificationStatus.APPROVED,
        verifiedAt: new Date(),
        verifiedBy: mockAdmin.id,
      };

      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.identityDocument.update as jest.Mock).mockResolvedValue(updatedDocument);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, idVerificationStatus: 'VERIFIED' });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-3' });

      const result = await kycService.reviewDocument(documentId, mockAdmin.id, reviewData);

      expect(result.status).toBe(VerificationStatus.APPROVED);
      expect(result.verifiedAt).toBeInstanceOf(Date);
      expect(result.verifiedBy).toBe(mockAdmin.id);
      
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { idVerificationStatus: 'VERIFIED' },
      });
      
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockAdmin.id,
          action: 'KYC_DOCUMENT_APPROVED',
          entityType: 'IdentityDocument',
          entityId: documentId,
          oldValues: JSON.stringify({ status: VerificationStatus.PENDING }),
          newValues: JSON.stringify({
            status: VerificationStatus.APPROVED,
            rejectionReason: null,
            verifiedBy: mockAdmin.id,
          }),
        },
      });
    });

    test('should reject document with reason', async () => {
      const documentId = 'doc-2';
      const reviewData: ReviewDocumentDto = {
        status: 'REJECTED',
        rejectionReason: 'Document is unclear or expired',
      };

      const mockDocument = {
        id: documentId,
        userId: mockUser.id,
        documentType: IdentityDocumentType.DRIVERS_LICENSE,
        status: VerificationStatus.PENDING,
      };

      const updatedDocument = {
        ...mockDocument,
        status: VerificationStatus.REJECTED,
        rejectionReason: reviewData.rejectionReason,
        verifiedAt: null,
        verifiedBy: mockAdmin.id,
      };

      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(mockDocument);
      (prisma.identityDocument.update as jest.Mock).mockResolvedValue(updatedDocument);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-4' });

      const result = await kycService.reviewDocument(documentId, mockAdmin.id, reviewData);

      expect(result.status).toBe(VerificationStatus.REJECTED);
      expect(result.rejectionReason).toBe(reviewData.rejectionReason);
      expect(result.verifiedAt).toBeNull();
      
      expect(prisma.user.update).not.toHaveBeenCalled(); // Should not update user status for rejection
      
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockAdmin.id,
          action: 'KYC_DOCUMENT_REJECTED',
          entityType: 'IdentityDocument',
          entityId: documentId,
          oldValues: JSON.stringify({ status: VerificationStatus.PENDING }),
          newValues: JSON.stringify({
            status: VerificationStatus.REJECTED,
            rejectionReason: reviewData.rejectionReason,
            verifiedBy: mockAdmin.id,
          }),
        },
      });
    });

    test('should throw error for non-existent document', async () => {
      const documentId = 'non-existent';
      const reviewData: ReviewDocumentDto = {
        status: 'APPROVED',
      };

      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(kycService.reviewDocument(documentId, mockAdmin.id, reviewData))
        .rejects.toThrow('Document not found');

      expect(prisma.identityDocument.update).not.toHaveBeenCalled();
    });

    test('should throw error for already reviewed document', async () => {
      const documentId = 'doc-3';
      const reviewData: ReviewDocumentDto = {
        status: 'APPROVED',
      };

      const mockDocument = {
        id: documentId,
        userId: mockUser.id,
        documentType: IdentityDocumentType.PASSPORT,
        status: VerificationStatus.APPROVED, // Already approved
      };

      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(mockDocument);

      await expect(kycService.reviewDocument(documentId, mockAdmin.id, reviewData))
        .rejects.toThrow('Document has already been reviewed');

      expect(prisma.identityDocument.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DOCUMENT RETRIEVAL
  // ============================================================================

  describe('Document Retrieval', () => {
    test('should get all user documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          userId: mockUser.id,
          documentType: IdentityDocumentType.PASSPORT,
          status: VerificationStatus.APPROVED,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'doc-2',
          userId: mockUser.id,
          documentType: IdentityDocumentType.DRIVERS_LICENSE,
          status: VerificationStatus.PENDING,
          createdAt: new Date('2026-01-02'),
        },
      ];

      (prisma.identityDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);

      const result = await kycService.getUserDocuments(mockUser.id);

      expect(result).toEqual(mockDocuments);
      expect(prisma.identityDocument.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { createdAt: 'desc' },
      });
    });

    test('should get pending documents for admin review', async () => {
      const mockPendingDocuments = [
        {
          id: 'doc-1',
          userId: 'user-1',
          documentType: IdentityDocumentType.PASSPORT,
          status: VerificationStatus.PENDING,
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      ];

      (prisma.identityDocument.findMany as jest.Mock).mockResolvedValue(mockPendingDocuments);
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(1);

      const result = await kycService.getPendingDocuments(1, 20);

      expect(result.documents).toEqual(mockPendingDocuments);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      
      expect(prisma.identityDocument.findMany).toHaveBeenCalledWith({
        where: { status: VerificationStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: 0,
        take: 20,
      });
    });
  });

  // ============================================================================
  // VERIFICATION STATUS CHECKS
  // ============================================================================

  describe('Verification Status Checks', () => {
    test('should check if user has verified document of specific type', async () => {
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(1);

      const result = await kycService.hasVerifiedDocument(
        mockUser.id, 
        IdentityDocumentType.PASSPORT
      );

      expect(result).toBe(true);
      expect(prisma.identityDocument.count).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          status: VerificationStatus.APPROVED,
          documentType: IdentityDocumentType.PASSPORT,
        },
      });
    });

    test('should check if user has any verified document', async () => {
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(0);

      const result = await kycService.hasVerifiedDocument(mockUser.id);

      expect(result).toBe(false);
      expect(prisma.identityDocument.count).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          status: VerificationStatus.APPROVED,
        },
      });
    });
  });

  // ============================================================================
  // DOCUMENT HISTORY
  // ============================================================================

  describe('Document History', () => {
    test('should get document history for user', async () => {
      const mockAuditEvents = [
        {
          id: 'audit-1',
          action: 'KYC_DOCUMENT_SUBMITTED',
          entityId: 'doc-1',
          createdAt: new Date('2026-01-01'),
          newValues: JSON.stringify({
            documentType: IdentityDocumentType.PASSPORT,
            status: VerificationStatus.PENDING,
          }),
        },
        {
          id: 'audit-2',
          action: 'KYC_DOCUMENT_APPROVED',
          entityId: 'doc-1',
          createdAt: new Date('2026-01-02'),
          newValues: JSON.stringify({
            status: VerificationStatus.APPROVED,
            verifiedBy: mockAdmin.id,
          }),
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockAuditEvents);

      const result = await kycService.getDocumentHistory(mockUser.id);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'audit-1',
        action: 'KYC_DOCUMENT_SUBMITTED',
        documentId: 'doc-1',
        timestamp: mockAuditEvents[0].createdAt,
        detail: {
          documentType: IdentityDocumentType.PASSPORT,
          status: VerificationStatus.PENDING,
        },
      });
      
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: 'IdentityDocument',
          action: {
            in: ['KYC_DOCUMENT_SUBMITTED', 'KYC_DOCUMENT_APPROVED', 'KYC_DOCUMENT_REJECTED'],
          },
          userId: mockUser.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });
});
