import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InsuranceStatus } from '@rental-portal/database';
import { $Enums } from '@rental-portal/database';
import { InsurancePolicy } from './insurance.service';

@Injectable()
export class InsurancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create insurance policy record
   */
  async createPolicy(data: Partial<InsurancePolicy>): Promise<InsurancePolicy> {
    const policy = await this.prisma.insurancePolicy.create({
      data: {
        policyNumber: data.policyNumber,
        bookingId: data.bookingId ?? null,
        propertyId: data.listingId as string,
        userId: data.userId as string,
        type: data.type as any,
        provider: data.provider as string,
        coverage: data.coverageAmount ?? 0,
        coverageAmount: data.coverageAmount ?? 0,
        premium: 0,
        currency: 'USD',
        status: (data.status as $Enums.InsuranceStatus) ?? $Enums.InsuranceStatus.ACTIVE,
        startDate: data.effectiveDate as Date,
        endDate: data.expirationDate as Date,
        documents: data.documentUrl ? [data.documentUrl] : [],
      },
    });

    return this.mapPolicy(policy);
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string): Promise<InsurancePolicy | null> {
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) return null;

    return this.mapPolicy(policy);
  }

  /**
   * Get active policy for listing
   */
  async getActivePolicy(listingId: string): Promise<InsurancePolicy | null> {
    const policy = await this.prisma.insurancePolicy.findFirst({
      where: {
        propertyId: listingId,
        status: $Enums.InsuranceStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      orderBy: { endDate: 'desc' },
    });

    if (!policy) return null;

    return this.mapPolicy(policy);
  }

  /**
   * Update policy status
   */
  async updatePolicyStatus(
    policyId: string,
    status: $Enums.InsuranceStatus,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.prisma.insurancePolicy.update({
      where: { id: policyId },
      data: { status },
    });

    if (metadata && Object.keys(metadata).length > 0) {
      await this.prisma.auditLog.create({
        data: {
          action: 'INSURANCE_POLICY_STATUS_UPDATED',
          entityType: 'INSURANCE_POLICY',
          entityId: policyId,
          newValues: JSON.stringify({
            status,
            ...metadata,
          }),
        },
      });
    }
  }

  /**
   * Get policies expiring soon
   */
  async getExpiringPolicies(expirationDate: Date): Promise<InsurancePolicy[]> {
    const policies = await this.prisma.insurancePolicy.findMany({
      where: {
        status: $Enums.InsuranceStatus.ACTIVE,
        endDate: {
          gt: new Date(),
          lte: expirationDate,
        },
      },
      orderBy: { endDate: 'asc' },
    });

    return policies.map((policy) => this.mapPolicy(policy));
  }

  /**
   * Get user's insurance policies
   */
  async getUserPolicies(userId: string): Promise<InsurancePolicy[]> {
    const policies = await this.prisma.insurancePolicy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return policies.map((policy) => this.mapPolicy(policy));
  }

  private mapPolicy(policy: any): InsurancePolicy {
    return {
      id: policy.id,
      userId: policy.userId,
      bookingId: policy.bookingId || undefined,
      listingId: policy.propertyId,
      policyNumber: policy.policyNumber,
      provider: policy.provider,
      type: policy.type,
      coverageAmount: Number(policy.coverageAmount ?? policy.coverage ?? 0),
      effectiveDate: policy.startDate,
      expirationDate: policy.endDate,
      documentUrl: Array.isArray(policy.documents) ? policy.documents[0] : '',
      status: policy.status,
    };
  }
}
