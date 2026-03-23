import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FraudDetectionService } from '@/modules/fraud-detection/services/fraud-detection.service';
import { InsuranceService } from '@/modules/insurance/services/insurance.service';
import { ContentModerationService } from '@/modules/moderation/services/content-moderation.service';
import { ComplianceService } from '@/modules/compliance/compliance.service';
import type {
  BookingEligibilityPort,
  EligibilityRequest,
  EligibilityResult,
} from '../ports/booking-eligibility.port';

/**
 * Safety check names used for fail-open/fail-closed configuration and
 * for the `skippedChecks` field in EligibilityResult.
 */
const CRITICAL_SAFETY_CHECKS = ['fraud', 'compliance', 'insurance'] as const;
type SafetyCheckName = (typeof CRITICAL_SAFETY_CHECKS)[number] | 'moderation';

/**
 * BookingEligibilityService — concrete implementation of BookingEligibilityPort.
 *
 * Orchestrates four independent safety checks in sequence:
 *   1. Compliance (jurisdiction requirements for the renter)
 *   2. Insurance (listing-level requirement)
 *   3. Moderation (booking message content)
 *   4. Fraud (velocity, value, risk scoring)
 *
 * Fail-closed is the default. Set SAFETY_CHECKS_FAIL_OPEN=true only in
 * non-production environments to enable fail-open degraded mode.
 */
@Injectable()
export class BookingEligibilityService implements BookingEligibilityPort {
  private readonly logger = new Logger(BookingEligibilityService.name);

  constructor(
    private readonly fraudDetection: FraudDetectionService,
    private readonly insuranceService: InsuranceService,
    private readonly moderationService: ContentModerationService,
    private readonly complianceService: ComplianceService,
    private readonly configService: ConfigService,
  ) {}

  async evaluate(request: EligibilityRequest): Promise<EligibilityResult> {
    const skippedChecks: string[] = [];

    // ── 1. Compliance ──────────────────────────────────────────────────────────
    const complianceResult = await this.runCompliance(request, skippedChecks);
    if (complianceResult.passed === false) {
      return { allowed: false, rejection: complianceResult.rejection, skippedChecks };
    }

    // ── 2. Insurance ──────────────────────────────────────────────────────────
    const insuranceResult = await this.runInsurance(request, skippedChecks);
    if (insuranceResult.passed === false) {
      return { allowed: false, rejection: insuranceResult.rejection, skippedChecks };
    }

    // ── 3. Content moderation (booking message, if provided) ──────────────────
    if (request.message) {
      const moderationResult = await this.runModeration(request, skippedChecks);
      if (moderationResult.passed === false) {
        return { allowed: false, rejection: moderationResult.rejection, skippedChecks };
      }
    }

    // ── 4. Fraud detection ────────────────────────────────────────────────────
    const stripeTestBypass = this.configService.get<string>('STRIPE_TEST_BYPASS') === 'true';
    if (!stripeTestBypass) {
      const fraudResult = await this.runFraud(request, skippedChecks);
      if (fraudResult.passed === false) {
        return { allowed: false, rejection: fraudResult.rejection, skippedChecks };
      }
    }

    return { allowed: true, skippedChecks };
  }

  // ── Private check runners ────────────────────────────────────────────────────

  private async runCompliance(
    request: EligibilityRequest,
    skippedChecks: string[],
  ): Promise<{ passed: true } | { passed: false; rejection: { reason: string; details?: Record<string, unknown> } }> {
    try {
      const result = await this.complianceService.evaluateCompliance(
        request.renterId,
        'USER',
        request.listing.country,
        request.listing.state,
        request.listing.city,
      );
      if (!result.overallCompliant && result.missingChecks.length > 0) {
        this.logger.warn(
          `Renter ${request.renterId} missing compliance: ${result.missingChecks.join(', ')}`,
        );
        if (this.shouldBlock('compliance')) {
          return {
            passed: false,
            rejection: {
              reason: 'Compliance requirements not met',
              details: { missingChecks: result.missingChecks },
            },
          };
        }
        this.logger.warn('Compliance requirements missing — proceeding in degraded mode');
        skippedChecks.push('compliance');
      }
      return { passed: true };
    } catch (error) {
      if (this.shouldBlock('compliance')) {
        this.logger.error('Compliance check unavailable — blocking (fail-closed)', error);
        return {
          passed: false,
          rejection: {
            reason: 'Unable to verify compliance requirements. Please try again later.',
            details: { code: 'SAFETY_CHECK_UNAVAILABLE', check: 'compliance' },
          },
        };
      }
      this.logger.warn('Compliance check failed, proceeding (degraded mode)', error);
      skippedChecks.push('compliance');
      return { passed: true };
    }
  }

  private async runInsurance(
    request: EligibilityRequest,
    skippedChecks: string[],
  ): Promise<{ passed: true } | { passed: false; rejection: { reason: string; details?: Record<string, unknown> } }> {
    try {
      const req = await this.insuranceService.checkInsuranceRequirement(request.listingId);
      if (req.required) {
        const hasInsurance = await this.insuranceService.hasValidInsurance(request.listingId);
        if (!hasInsurance) {
          if (this.shouldBlock('insurance')) {
            return {
              passed: false,
              rejection: {
                reason: 'Insurance is required for this listing',
                details: {
                  reason: req.reason || 'Category or value requires insurance coverage',
                  insuranceRequired: true,
                },
              },
            };
          }
          this.logger.warn(
            `Insurance required but missing for ${request.listingId} — proceeding in degraded mode`,
          );
          skippedChecks.push('insurance');
        }
      }
      return { passed: true };
    } catch (error) {
      if (this.shouldBlock('insurance')) {
        this.logger.error(
          `Insurance check unavailable for ${request.listingId} — blocking (fail-closed)`,
          error,
        );
        return {
          passed: false,
          rejection: {
            reason: 'Unable to verify insurance requirements. Please try again later.',
            details: { code: 'SAFETY_CHECK_UNAVAILABLE', check: 'insurance' },
          },
        };
      }
      this.logger.warn(`Insurance check failed for ${request.listingId}, proceeding (degraded)`, error);
      skippedChecks.push('insurance');
      return { passed: true };
    }
  }

  private async runModeration(
    request: EligibilityRequest,
    skippedChecks: string[],
  ): Promise<{ passed: true } | { passed: false; rejection: { reason: string; details?: Record<string, unknown> } }> {
    try {
      const result = await this.moderationService.moderateMessage(request.message!);
      if (result.status === 'REJECTED' || result.status === 'FLAGGED') {
        return {
          passed: false,
          rejection: {
            reason: 'Your message contains content that violates our policies',
            details: { flags: result.flags },
          },
        };
      }
      return { passed: true };
    } catch (error) {
      if (this.shouldBlock('moderation')) {
        this.logger.error('Moderation service unavailable — blocking (fail-closed)', error);
        return {
          passed: false,
          rejection: {
            reason: 'Unable to verify message content. Please try again later.',
            details: { code: 'SAFETY_CHECK_UNAVAILABLE', check: 'moderation' },
          },
        };
      }
      this.logger.warn('Message moderation failed, proceeding (degraded mode)', error);
      skippedChecks.push('moderation');
      return { passed: true };
    }
  }

  private async runFraud(
    request: EligibilityRequest,
    skippedChecks: string[],
  ): Promise<{ passed: true } | { passed: false; rejection: { reason: string; details?: Record<string, unknown> } }> {
    try {
      const result = await this.fraudDetection.performBookingFraudCheck({
        userId: request.renterId,
        listingId: request.listingId,
        totalPrice: request.totalPrice,
        currency: request.listing.currency ?? undefined,
        startDate: request.startDate,
        endDate: request.endDate,
      });
      if (!result.allowBooking) {
        this.logger.warn(
          `Booking rejected for ${request.renterId}: fraud score ${result.riskScore}, ` +
            `flags: ${result.flags.map((f: any) => f.type).join(',')}`,
        );
        // Return a generic rejection to avoid enumeration of fraud signals.
        return {
          passed: false,
          rejection: { reason: 'Booking request could not be approved at this time.' },
        };
      }
      return { passed: true };
    } catch (error) {
      if (this.shouldBlock('fraud')) {
        this.logger.error('Fraud detection unavailable — blocking (fail-closed)', error);
        return {
          passed: false,
          rejection: {
            reason: 'Unable to verify booking safety. Please try again later.',
            details: { code: 'SAFETY_CHECK_UNAVAILABLE', check: 'fraud' },
          },
        };
      }
      this.logger.warn('Fraud check failed, proceeding (degraded mode)', error);
      skippedChecks.push('fraud');
      return { passed: true };
    }
  }

  private shouldBlock(checkName: SafetyCheckName): boolean {
    const failOpen = this.configService.get<string>('SAFETY_CHECKS_FAIL_OPEN', 'false');
    if (failOpen === 'true') {
      return false;
    }
    return (CRITICAL_SAFETY_CHECKS as readonly string[]).includes(checkName);
  }
}
