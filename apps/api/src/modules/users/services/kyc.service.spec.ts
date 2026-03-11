import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KycService, UploadDocumentDto, ReviewDocumentDto } from './kyc.service';
import { PrismaService } from '@/common/prisma/prisma.service';

// Mock enums
const VerificationStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };

describe('KycService', () => {
  let service: KycService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-kyc-1';
  const mockAdminId = 'admin-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: PrismaService,
          useValue: {
            identityDocument: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get(KycService);
    prisma = module.get(PrismaService);
  });

  describe('uploadDocument', () => {
    const dto: UploadDocumentDto = {
      documentType: 'CITIZENSHIP' as any,
      documentUrl: 'https://s3.example.com/doc.pdf',
    };

    it('creates document when no pending exists', async () => {
      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      const created = { id: 'doc-1', ...dto, status: 'PENDING' };
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue(created);

      const result = await service.uploadDocument(mockUserId, dto);
      expect(result).toEqual(created);
      expect(prisma.identityDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          documentType: dto.documentType,
          documentUrl: dto.documentUrl,
          status: 'PENDING',
        }),
      });
    });

    it('throws BadRequestException when pending document of same type exists', async () => {
      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.uploadDocument(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });

    it('sets expiresAt when provided', async () => {
      (prisma.identityDocument.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.identityDocument.create as jest.Mock).mockResolvedValue({ id: 'doc-2' });

      const dtoWithExpiry = { ...dto, expiresAt: '2025-12-31' };
      await service.uploadDocument(mockUserId, dtoWithExpiry);

      expect(prisma.identityDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date('2025-12-31'),
        }),
      });
    });
  });

  describe('getUserDocuments', () => {
    it('returns user documents ordered by createdAt desc', async () => {
      const docs = [{ id: 'doc-1' }, { id: 'doc-2' }];
      (prisma.identityDocument.findMany as jest.Mock).mockResolvedValue(docs);

      const result = await service.getUserDocuments(mockUserId);
      expect(result).toEqual(docs);
      expect(prisma.identityDocument.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('reviewDocument', () => {
    const mockDoc = { id: 'doc-1', userId: 'user-1', status: 'PENDING' };

    it('throws NotFoundException when document not found', async () => {
      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reviewDocument('doc-404', mockAdminId, { status: 'APPROVED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when document already reviewed', async () => {
      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue({
        ...mockDoc,
        status: 'APPROVED',
      });

      await expect(
        service.reviewDocument(mockDoc.id, mockAdminId, { status: 'APPROVED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves document and updates user verification status', async () => {
      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(mockDoc);
      (prisma.identityDocument.update as jest.Mock).mockResolvedValue({
        ...mockDoc,
        status: 'APPROVED',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.reviewDocument(mockDoc.id, mockAdminId, { status: 'APPROVED' });

      expect(prisma.identityDocument.update).toHaveBeenCalledWith({
        where: { id: mockDoc.id },
        data: expect.objectContaining({
          status: 'APPROVED',
          verifiedBy: mockAdminId,
        }),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockDoc.userId },
        data: { idVerificationStatus: 'VERIFIED' },
      });
    });

    it('rejects document with reason and does NOT update user', async () => {
      (prisma.identityDocument.findUnique as jest.Mock).mockResolvedValue(mockDoc);
      (prisma.identityDocument.update as jest.Mock).mockResolvedValue({
        ...mockDoc,
        status: 'REJECTED',
      });

      await service.reviewDocument(mockDoc.id, mockAdminId, {
        status: 'REJECTED',
        rejectionReason: 'Blurry image',
      });

      expect(prisma.identityDocument.update).toHaveBeenCalledWith({
        where: { id: mockDoc.id },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Blurry image',
          verifiedAt: null,
        }),
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getPendingDocuments', () => {
    it('returns paginated pending documents', async () => {
      const items = [{ id: 'doc-1' }];
      (prisma.identityDocument.findMany as jest.Mock).mockResolvedValue(items);
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPendingDocuments(1, 10);
      expect(result).toEqual({ items, total: 1, page: 1, limit: 10 });
    });

    it('uses default pagination', async () => {
      (prisma.identityDocument.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(0);

      await service.getPendingDocuments();
      expect(prisma.identityDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('hasVerifiedDocument', () => {
    it('returns true when verified document exists', async () => {
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(1);
      expect(await service.hasVerifiedDocument(mockUserId)).toBe(true);
    });

    it('returns false when no verified document', async () => {
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(0);
      expect(await service.hasVerifiedDocument(mockUserId)).toBe(false);
    });

    it('filters by document type when provided', async () => {
      (prisma.identityDocument.count as jest.Mock).mockResolvedValue(1);
      await service.hasVerifiedDocument(mockUserId, 'PASSPORT' as any);
      expect(prisma.identityDocument.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ documentType: 'PASSPORT' }),
      });
    });
  });
});
