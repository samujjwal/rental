/**
 * Booking Eligibility Port — anti-corruption layer between the booking workflow
 * and the four safety/compliance check services.
 *
 * BookingsService depends on this interface, not on FraudDetectionService,
 * InsuranceService, ContentModerationService, or ComplianceService directly.
 *
 * This keeps the booking lifecycle code focused on workflow orchestration while
 * the safety/policy evaluation lives in one place where it can be evolved,
 * tested, and configured independently.
 */

export interface EligibilityRequest {
  renterId: string;
  listingId: string;
  /** Optional booking message for content moderation. */
  message?: string;
  /** Calculated total price (subtotal, before tax) — used for fraud risk scoring. */
  totalPrice: number;
  startDate: Date;
  endDate: Date;
  listing: {
    country?: string | null;
    state?: string | null;
    city?: string | null;
    currency?: string | null;
  };
}

export interface EligibilityRejection {
  /** Human-readable reason returned in the API error response. */
  reason: string;
  /** Optional structured details for the error response body. */
  details?: Record<string, unknown>;
}

export interface EligibilityResult {
  /**
   * True when the booking is permitted to proceed.
   * False when at least one critical safety check explicitly rejected it.
   */
  allowed: boolean;

  /**
   * Present only when `allowed` is false.
   * Callers should throw the corresponding error using these fields.
   */
  rejection?: EligibilityRejection;

  /**
   * Names of checks that could not be completed due to service unavailability
   * and were skipped in fail-open mode. Callers should persist this list in
   * booking metadata and flag the booking for manual review.
   */
  skippedChecks: string[];
}

export interface BookingEligibilityPort {
  /**
   * Evaluate whether a prospective booking passes all safety and compliance checks.
   *
   * Must never throw on provider errors — service failures are handled internally
   * according to the fail-open / fail-closed configuration.
   */
  evaluate(request: EligibilityRequest): Promise<EligibilityResult>;
}

export const BOOKING_ELIGIBILITY_PORT = Symbol('BookingEligibilityPort');
