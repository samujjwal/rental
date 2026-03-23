import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';

@Injectable()
export class InsuranceVerificationService {
  private readonly logger = new Logger(InsuranceVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Queue insurance policy for verification
   */
  async queueVerification(policyId: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: 'INSURANCE_VERIFICATION_QUEUED',
        entityType: 'INSURANCE_POLICY',
        entityId: policyId,
        newValues: JSON.stringify({
          status: 'PENDING',
          queuedAt: new Date(),
        }),
      },
    });

    this.logger.log(`Insurance policy queued for verification: ${policyId}`);
  }

  private getAuditLogPayload(item: { newValues?: unknown; metadata?: unknown }): Record<string, unknown> {
    const candidates = [item.newValues, item.metadata];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      if (typeof candidate === 'string') {
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, unknown>;
          }
        } catch {
          continue;
        }
      }

      if (typeof candidate === 'object') {
        return candidate as Record<string, unknown>;
      }
    }

    return {};
  }

  /**
   * Get verification queue
   */
  async getVerificationQueue(): Promise<any[]> {
    const items = await this.prisma.auditLog.findMany({
      where: {
        action: 'INSURANCE_VERIFICATION_QUEUED',
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return items.filter((item) => this.getAuditLogPayload(item).status === 'PENDING');
  }

  /**
   * Automated verification checks.
   *
   * NOTE: OCR-based automated verification (carrier API, document parsing) is
   * not yet implemented. Every submission is flagged for mandatory manual review
   * by an admin. The confidence value of 0 explicitly signals no automated
   * analysis was performed — callers MUST NOT auto-approve based on this result.
   */
  async runAutomatedChecks(policyId: string): Promise<{
    passed: boolean;
    requiresManualReview: boolean;
    flags: string[];
    confidence: number;
  }> {
    const flags: string[] = [];

    const policy = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'INSURANCE_POLICY',
        entityId: policyId,
      },
    });

    if (!policy) {
      flags.push('Policy record not found');
      return { passed: false, requiresManualReview: false, flags, confidence: 0 };
    }

    // Automated carrier API / OCR verification not yet implemented.
    // All policies are routed to the manual admin review queue.
    // This is distinct from an automated rejection — the policy is valid enough
    // to warrant human inspection; it has not been automatically rejected.
    flags.push('Queued for manual admin verification — automated OCR/carrier checks are not yet enabled');

    this.logger.log(
      `Insurance policy ${policyId} queued for manual review (automated checks not implemented).`,
    );

    return {
      passed: false,
      requiresManualReview: true,
      flags,
      confidence: 0,
    };
  }

  /**
   * Verify insurance provider (check against known providers)
   */
  async verifyProvider(provider: string): Promise<boolean> {
    const knownProviders = await this.getKnownProviders();
    return knownProviders.some((known) => known.toLowerCase() === provider.toLowerCase());
  }

  /**
   * Get list of known insurance providers (Nepal and South Asia focus).
   * Providers registered with the Insurance Authority of Nepal (Beema Samiti)
   * and regional non-life insurers.
   */
  private async getKnownProviders(): Promise<string[]> {
    // Cache for 24 hours
    const cached = await this.cache.get<string[]>('insurance:providers');
    if (cached) return cached;

    const providers = [
      // Nepal — Non-life insurers (Insurance Authority of Nepal registered)
      'Nepal Insurance Company',
      'National Insurance Company',
      'Himalayan General Insurance',
      'Sagarmatha Insurance Company',
      'NIC Asia General Insurance',
      'Shikhar Insurance',
      'Lumbini General Insurance',
      'Everest Insurance Company',
      'Prudential Insurance Company',
      'Siddhartha Insurance Company',
      'Prabhu Insurance',
      'Excel Development Bank Insurance',
      // India — national and major private non-life insurers
      'New India Assurance',
      'National Insurance Company India',
      'United India Insurance',
      'Oriental Insurance Company',
      'Bajaj Allianz General Insurance',
      'HDFC ERGO General Insurance',
      'ICICI Lombard General Insurance',
      'Tata AIG General Insurance',
      // Bangladesh
      'Sadharan Bima Corporation',
      'Green Delta Insurance',
      // Sri Lanka
      'Sri Lanka Insurance Corporation',
      'AIA Insurance Sri Lanka',
      'Ceylinco Insurance',
    ];

    await this.cache.set('insurance:providers', providers, 86400); // 24 hours
    return providers;
  }

  /**
   * OCR document processing — NOT YET IMPLEMENTED.
   *
   * Returns an empty object. In production this should call AWS Textract,
   * Google Document AI, or a similar OCR provider to extract structured
   * data from the insurance document image/PDF.
   *
   * Until integrated, the admin review workflow covers this gap:
   * `runAutomatedChecks()` returns `requiresManualReview: true` for all
   * submissions, routing them to the admin queue.
   */
  async extractPolicyDetails(documentUrl: string): Promise<{
    policyNumber?: string;
    provider?: string;
    effectiveDate?: Date;
    expirationDate?: Date;
    coverageAmount?: number;
  }> {
    this.logger.log(
      `OCR extraction requested for ${documentUrl} — returning empty (manual review required).`,
    );
    return {};
  }
}
