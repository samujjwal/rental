import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InsuranceVerificationService } from './insurance-verification.service';
import { InsurancePolicyService } from './insurance-policy.service';
import { toNumber } from '@rental-portal/database';

export enum InsuranceStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  REQUIRED = 'REQUIRED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export interface InsuranceRequirement {
  required: boolean;
  type: string; // 'LIABILITY', 'COMPREHENSIVE', 'COLLISION', 'DAMAGE'
  minimumCoverage: number;
  reason: string;
}

export interface InsurancePolicy {
  id: string;
  userId: string;
  listingId?: string;
  policyNumber: string;
  provider: string;
  type: string;
  coverageAmount: number;
  effectiveDate: Date;
  expirationDate: Date;
  documentUrl: string;
  status: InsuranceStatus;
  verificationDate?: Date;
  notes?: string;
}

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: InsuranceVerificationService,
    private readonly policyService: InsurancePolicyService,
  ) {}

  /**
   * Check if insurance is required for a listing
   */
  async checkInsuranceRequirement(listingId: string): Promise<InsuranceRequirement> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true },
    });

    if (!listing) {
      throw new BadRequestException('Listing not found');
    }

    // Determine insurance requirements based on category and value
    const categoryRequirements = this.getCategoryRequirements(listing.category.name);
    const listingPrice = toNumber(listing.basePrice); // dailyPrice doesn't exist in schema
    const valueRequirements = this.getValueRequirements(listingPrice);

    const required =
      categoryRequirements.required || valueRequirements.required || listingPrice > 500;

    return {
      required,
      type: categoryRequirements.type || 'LIABILITY',
      minimumCoverage: Math.max(
        categoryRequirements.minimumCoverage || 0,
        valueRequirements.minimumCoverage || 0,
        listingPrice * 2, // At least 2x the daily rate
      ),
      reason: required
        ? categoryRequirements.reason ||
          valueRequirements.reason ||
          'High-value item requires insurance'
        : 'Insurance not required for this listing',
    };
  }

  /**
   * Upload insurance policy for listing
   */
  async uploadInsurancePolicy(data: {
    userId: string;
    listingId: string;
    policyNumber: string;
    provider: string;
    type: string;
    coverageAmount: number;
    effectiveDate: Date;
    expirationDate: Date;
    documentUrl: string;
  }): Promise<InsurancePolicy> {
    // Validate policy dates
    if (new Date(data.expirationDate) <= new Date()) {
      throw new BadRequestException('Insurance policy is already expired');
    }

    if (new Date(data.effectiveDate) > new Date(data.expirationDate)) {
      throw new BadRequestException('Effective date must be before expiration date');
    }

    // Check if policy meets requirements
    const requirement = await this.checkInsuranceRequirement(data.listingId);
    if (requirement.required && data.coverageAmount < requirement.minimumCoverage) {
      throw new BadRequestException(
        `Coverage amount must be at least $${requirement.minimumCoverage}`,
      );
    }

    // Create policy record
    const policy = await this.policyService.createPolicy({
      ...data,
      status: InsuranceStatus.PENDING,
    });

    // Queue for verification
    await this.verificationService.queueVerification(policy.id);

    this.logger.log(`Insurance policy uploaded: ${policy.id} for listing ${data.listingId}`);

    return policy;
  }

  /**
   * Verify insurance policy (admin/automated)
   */
  async verifyInsurancePolicy(
    policyId: string,
    verifiedBy: string,
    approved: boolean,
    notes?: string,
  ): Promise<void> {
    const policy = await this.policyService.getPolicy(policyId);

    if (!policy) {
      throw new BadRequestException('Insurance policy not found');
    }

    const newStatus = approved ? InsuranceStatus.VERIFIED : InsuranceStatus.REJECTED;

    await this.policyService.updatePolicyStatus(policyId, newStatus, {
      verificationDate: new Date(),
      verifiedBy,
      notes,
    });

    // Update listing insurance status
    // Insurance verification fields don't exist in Property schema, skipping update
    // if (policy.listingId) {
    //   await this.prisma.listing.update({
    //     where: { id: policy.listingId },
    //     data: {
    //       insuranceVerified: approved,
    //       insurancePolicyId: approved ? policyId : null,
    //       insuranceVerifiedAt: approved ? new Date() : null,
    //     },
    //   });
    // }

    this.logger.log(`Insurance policy ${approved ? 'verified' : 'rejected'}: ${policyId}`);
  }

  /**
   * Check if listing has valid insurance
   */
  async hasValidInsurance(listingId: string): Promise<boolean> {
    const policy = await this.policyService.getActivePolicy(listingId);

    if (!policy) return false;

    // Check if policy is verified and not expired
    return (
      policy.status === InsuranceStatus.VERIFIED && new Date(policy.expirationDate) > new Date()
    );
  }

  /**
   * Get expiring policies (for notifications)
   */
  async getExpiringPolicies(daysBeforeExpiry: number = 30): Promise<InsurancePolicy[]> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysBeforeExpiry);

    return this.policyService.getExpiringPolicies(expirationDate);
  }

  /**
   * Generate insurance certificate
   */
  async generateCertificate(policyId: string): Promise<{ url: string }> {
    const policy = await this.policyService.getPolicy(policyId);

    if (!policy || policy.status !== InsuranceStatus.VERIFIED) {
      throw new BadRequestException('Valid insurance policy not found');
    }

    // In production: Generate PDF certificate
    const certificateData = {
      policyNumber: policy.policyNumber,
      provider: policy.provider,
      coverageAmount: policy.coverageAmount,
      effectiveDate: policy.effectiveDate,
      expirationDate: policy.expirationDate,
      generatedAt: new Date(),
    };

    // Use uploaded document as certificate for MVP
    return { url: policy.documentUrl };
  }

  /**
   * Get category-specific insurance requirements
   */
  private getCategoryRequirements(category: string): {
    required: boolean;
    type?: string;
    minimumCoverage?: number;
    reason?: string;
  } {
    const requirements: Record<string, any> = {
      Vehicles: {
        required: true,
        type: 'COMPREHENSIVE',
        minimumCoverage: 50000,
        reason: 'Vehicle rentals require comprehensive insurance coverage',
      },
      'Heavy Equipment': {
        required: true,
        type: 'LIABILITY',
        minimumCoverage: 100000,
        reason: 'Heavy equipment requires liability insurance',
      },
      Boats: {
        required: true,
        type: 'COMPREHENSIVE',
        minimumCoverage: 75000,
        reason: 'Watercraft require comprehensive insurance',
      },
      Aircraft: {
        required: true,
        type: 'COMPREHENSIVE',
        minimumCoverage: 500000,
        reason: 'Aircraft require extensive insurance coverage',
      },
    };

    return requirements[category] || { required: false };
  }

  /**
   * Get value-based insurance requirements
   */
  private getValueRequirements(dailyRate: number): {
    required: boolean;
    minimumCoverage?: number;
    reason?: string;
  } {
    if (dailyRate > 1000) {
      return {
        required: true,
        minimumCoverage: dailyRate * 5,
        reason: 'High-value items require insurance protection',
      };
    }

    if (dailyRate > 500) {
      return {
        required: true,
        minimumCoverage: dailyRate * 3,
        reason: 'Mid-value items should be insured',
      };
    }

    return { required: false };
  }
}
