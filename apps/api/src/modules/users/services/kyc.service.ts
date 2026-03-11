import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { i18nNotFound, i18nBadRequest } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityDocumentType, VerificationStatus } from '@rental-portal/database';

export interface UploadDocumentDto {
  documentType: IdentityDocumentType;
  documentUrl: string;
  expiresAt?: string;
}

export interface ReviewDocumentDto {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upload an identity document for verification.
   */
  async uploadDocument(userId: string, dto: UploadDocumentDto) {
    // Check for existing pending document of same type
    const existing = await this.prisma.identityDocument.findFirst({
      where: {
        userId,
        documentType: dto.documentType,
        status: VerificationStatus.PENDING,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have a pending document of this type. Please wait for review.',
      );
    }

    const doc = await this.prisma.identityDocument.create({
      data: {
        userId,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: VerificationStatus.PENDING,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'KYC_DOCUMENT_SUBMITTED',
        entityType: 'IdentityDocument',
        entityId: doc.id,
        newValues: JSON.stringify({ documentType: dto.documentType, status: VerificationStatus.PENDING }),
      },
    });

    this.logger.log(`Document uploaded for user ${userId}: ${dto.documentType}`);
    return doc;
  }

  /**
   * Get all documents for a user.
   */
  async getUserDocuments(userId: string) {
    return this.prisma.identityDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: review a document.
   */
  async reviewDocument(documentId: string, adminId: string, dto: ReviewDocumentDto) {
    const doc = await this.prisma.identityDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw i18nNotFound('kyc.documentNotFound');
    }

    if (doc.status !== VerificationStatus.PENDING) {
      throw i18nBadRequest('kyc.alreadyReviewed');
    }

    const status =
      dto.status === 'APPROVED' ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;

    const updated = await this.prisma.identityDocument.update({
      where: { id: documentId },
      data: {
        status,
        rejectionReason: dto.status === 'REJECTED' ? dto.rejectionReason : null,
        verifiedAt: dto.status === 'APPROVED' ? new Date() : null,
        verifiedBy: adminId,
      },
    });

    // If approved, update user's idVerificationStatus
    if (dto.status === 'APPROVED') {
      await this.prisma.user.update({
        where: { id: doc.userId },
        data: { idVerificationStatus: 'VERIFIED' },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: dto.status === 'APPROVED' ? 'KYC_DOCUMENT_APPROVED' : 'KYC_DOCUMENT_REJECTED',
        entityType: 'IdentityDocument',
        entityId: documentId,
        oldValues: JSON.stringify({ status: VerificationStatus.PENDING }),
        newValues: JSON.stringify({
          status,
          rejectionReason: dto.rejectionReason ?? null,
          verifiedBy: adminId,
        }),
      },
    });

    this.logger.log(`Document ${documentId} ${dto.status} by admin ${adminId}`);
    return updated;
  }

  /**
   * Admin: get all pending documents for review.
   */
  async getPendingDocuments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.identityDocument.findMany({
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
        skip,
        take: limit,
      }),
      this.prisma.identityDocument.count({
        where: { status: VerificationStatus.PENDING },
      }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Get KYC document status history for a user from AuditLog.
   */
  async getDocumentHistory(userId: string) {
    const events = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'IdentityDocument',
        action: {
          in: ['KYC_DOCUMENT_SUBMITTED', 'KYC_DOCUMENT_APPROVED', 'KYC_DOCUMENT_REJECTED'],
        },
        userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return events.map((e) => ({
      id: e.id,
      action: e.action,
      documentId: e.entityId,
      timestamp: e.createdAt,
      detail: e.newValues ? JSON.parse(e.newValues as string) : null,
    }));
  }

  /**
   * Check if user has a verified identity document of a given type.
   */
  async hasVerifiedDocument(userId: string, type?: IdentityDocumentType): Promise<boolean> {
    const where = {
      userId,
      status: VerificationStatus.APPROVED,
      ...(type ? { documentType: type } : {}),
    } as const;

    const count = await this.prisma.identityDocument.count({ where });
    return count > 0;
  }
}
