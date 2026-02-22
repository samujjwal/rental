import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
      throw new NotFoundException('Document not found');
    }

    if (doc.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Document has already been reviewed');
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
   * Check if user has a verified identity document of a given type.
   */
  async hasVerifiedDocument(userId: string, type?: IdentityDocumentType): Promise<boolean> {
    const where: any = {
      userId,
      status: VerificationStatus.APPROVED,
    };
    if (type) where.documentType = type;

    const count = await this.prisma.identityDocument.count({ where });
    return count > 0;
  }
}
