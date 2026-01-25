import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InsuranceStatus, InsurancePolicy } from './insurance.service';

@Injectable()
export class InsurancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create insurance policy record
   */
  async createPolicy(data: Partial<InsurancePolicy>): Promise<InsurancePolicy> {
    // In production: Store in insurance_policies table
    // const policy = await this.prisma.insurancePolicy.create({ data });

    // For now, create audit log entry
    const auditLog = await this.prisma.auditLog.create({
      data: {
        action: 'INSURANCE_POLICY_CREATED',
        entityType: 'INSURANCE_POLICY',
        entityId: data.listingId || data.userId || '',
        userId: data.userId,
        metadata: data,
      },
    });

    return {
      id: auditLog.id,
      ...data,
    } as InsurancePolicy;
  }

  /**
   * Get policy by ID
   */
  async getPolicy(policyId: string): Promise<InsurancePolicy | null> {
    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        id: policyId,
        action: 'INSURANCE_POLICY_CREATED',
      },
    });

    if (!auditLog) return null;

    return {
      id: auditLog.id,
      ...(auditLog.metadata as any),
    } as InsurancePolicy;
  }

  /**
   * Get active policy for listing
   */
  async getActivePolicy(listingId: string): Promise<InsurancePolicy | null> {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'INSURANCE_POLICY_CREATED',
        entityId: listingId,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const log of auditLogs) {
      const metadata = log.metadata as any;
      if (
        metadata.status === InsuranceStatus.VERIFIED &&
        new Date(metadata.expirationDate) > new Date()
      ) {
        return {
          id: log.id,
          ...metadata,
        } as InsurancePolicy;
      }
    }

    return null;
  }

  /**
   * Update policy status
   */
  async updatePolicyStatus(
    policyId: string,
    status: InsuranceStatus,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: 'INSURANCE_POLICY_STATUS_UPDATED',
        entityType: 'INSURANCE_POLICY',
        entityId: policyId,
        metadata: {
          status,
          ...metadata,
        },
      },
    });
  }

  /**
   * Get policies expiring soon
   */
  async getExpiringPolicies(expirationDate: Date): Promise<InsurancePolicy[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'INSURANCE_POLICY_CREATED',
      },
    });

    const expiring: InsurancePolicy[] = [];

    for (const log of logs) {
      const metadata = log.metadata as any;
      const expiry = new Date(metadata.expirationDate);

      if (
        metadata.status === InsuranceStatus.VERIFIED &&
        expiry > new Date() &&
        expiry <= expirationDate
      ) {
        expiring.push({
          id: log.id,
          ...metadata,
        } as InsurancePolicy);
      }
    }

    return expiring;
  }

  /**
   * Get user's insurance policies
   */
  async getUserPolicies(userId: string): Promise<InsurancePolicy[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'INSURANCE_POLICY_CREATED',
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return logs.map(
      (log) =>
        ({
          id: log.id,
          ...(log.metadata as any),
        }) as InsurancePolicy,
    );
  }
}
