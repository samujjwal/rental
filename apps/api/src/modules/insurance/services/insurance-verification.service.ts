import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

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
        metadata: {
          status: 'PENDING',
          queuedAt: new Date(),
        },
      },
    });

    this.logger.log(`Insurance policy queued for verification: ${policyId}`);
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

    return items.filter((item) => (item.metadata as any)?.status === 'PENDING');
  }

  /**
   * Automated verification checks
   */
  async runAutomatedChecks(policyId: string): Promise<{
    passed: boolean;
    flags: string[];
    confidence: number;
  }> {
    const flags: string[] = [];
    let confidence = 1.0;

    // TODO: Implement automated checks:
    // 1. OCR to extract policy details
    // 2. Verify policy number format
    // 3. Check provider against known insurance companies
    // 4. Validate dates
    // 5. Check coverage amounts

    // Example checks
    const policy = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'INSURANCE_POLICY',
        entityId: policyId,
      },
    });

    if (!policy) {
      flags.push('Policy not found');
      confidence = 0;
    }

    // If coverage seems too low
    // if (policy.coverageAmount < threshold) {
    //   flags.push('Coverage amount below expected threshold');
    //   confidence -= 0.2;
    // }

    const passed = flags.length === 0 && confidence > 0.7;

    return { passed, flags, confidence };
  }

  /**
   * Verify insurance provider (check against known providers)
   */
  async verifyProvider(provider: string): Promise<boolean> {
    const knownProviders = await this.getKnownProviders();
    return knownProviders.some(
      (known) => known.toLowerCase() === provider.toLowerCase(),
    );
  }

  /**
   * Get list of known insurance providers
   */
  private async getKnownProviders(): Promise<string[]> {
    // Cache for 24 hours
    const cached = await this.cache.get<string[]>('insurance:providers');
    if (cached) return cached;

    const providers = [
      'State Farm',
      'Geico',
      'Progressive',
      'Allstate',
      'USAA',
      'Liberty Mutual',
      'Farmers Insurance',
      'Nationwide',
      'Travelers',
      'American Family',
      // Add more providers
    ];

    await this.cache.set('insurance:providers', providers, 86400); // 24 hours
    return providers;
  }

  /**
   * OCR document processing (placeholder)
   */
  async extractPolicyDetails(documentUrl: string): Promise<{
    policyNumber?: string;
    provider?: string;
    effectiveDate?: Date;
    expirationDate?: Date;
    coverageAmount?: number;
  }> {
    // In production: Use AWS Textract, Google Vision API, or similar
    // to extract text from insurance document

    return {};
  }
}
