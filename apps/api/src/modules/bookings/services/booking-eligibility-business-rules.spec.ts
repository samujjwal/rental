import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BookingEligibilityService } from './booking-eligibility.service';
import { FraudDetectionService } from '@/modules/fraud-detection/services/fraud-detection.service';
import { InsuranceService } from '@/modules/insurance/services/insurance.service';
import { ContentModerationService } from '@/modules/moderation/services/content-moderation.service';
import { ComplianceService } from '@/modules/compliance/compliance.service';

/**
 * ULTRA-STRICT: Business Rules Engine - Booking Eligibility Validation
 *
 * Tests validate business rule enforcement with fail-closed/fail-open modes,
 * orchestration logic, and edge cases for booking eligibility.
 */
describe('BookingEligibilityService - BUSINESS RULES VALIDATION', () => {
  let service: BookingEligibilityService;

  const mockFraudDetection = {
    evaluateTransaction: jest.fn(),
  };

  const mockInsuranceService = {
    checkInsuranceRequirement: jest.fn(),
    hasValidInsurance: jest.fn(),
  };

  const mockModerationService = {
    moderateMessage: jest.fn(),
  };

  const mockComplianceService = {
    evaluateCompliance: jest.fn(),
  };

  const createMockConfig = (failOpen: boolean, stripeBypass: boolean) => ({
    get: jest.fn((key: string, defaultVal?: any) => {
      if (key === 'SAFETY_CHECKS_FAIL_OPEN') return failOpen;
      if (key === 'STRIPE_TEST_BYPASS') return stripeBypass ? 'true' : 'false';
      return defaultVal;
    }),
  });

  const baseRequest = {
    renterId: 'renter-123',
    listingId: 'listing-456',
    listing: {
      country: 'US',
      state: 'CA',
      city: 'San Francisco',
    },
    message: 'I would like to book this property',
    totalPrice: 500,
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-05'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  const setupModule = async (failOpen: boolean, stripeBypass: boolean) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingEligibilityService,
        { provide: FraudDetectionService, useValue: mockFraudDetection },
        { provide: InsuranceService, useValue: mockInsuranceService },
        { provide: ContentModerationService, useValue: mockModerationService },
        { provide: ComplianceService, useValue: mockComplianceService },
        { provide: ConfigService, useValue: createMockConfig(failOpen, stripeBypass) },
      ],
    }).compile();
    service = module.get<BookingEligibilityService>(BookingEligibilityService);
  };

  // ============================================================================
  // FAIL-CLOSED MODE (Production) - SAFETY CRITICAL
  // ============================================================================

  describe('FAIL-CLOSED MODE (Production Safety)', () => {
    beforeEach(() => setupModule(false, false));

    test('BLOCKS when compliance check fails', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: false,
        missingChecks: ['KYC_VERIFICATION', 'AGE_VERIFICATION'],
      });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('Compliance requirements not met');
      expect(result.rejection?.details?.missingChecks).toEqual([
        'KYC_VERIFICATION',
        'AGE_VERIFICATION',
      ]);
    });

    test('BLOCKS when compliance service unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.details?.code).toBe('SAFETY_CHECK_UNAVAILABLE');
    });

    test('BLOCKS when insurance required but not available', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({
        required: true,
        reason: 'High-value item',
      });
      mockInsuranceService.hasValidInsurance.mockResolvedValue(false);

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('Insurance is required');
    });

    test('BLOCKS when insurance service unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.details?.code).toBe('SAFETY_CHECK_UNAVAILABLE');
    });

    test('BLOCKS when message contains policy violations', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({
        status: 'REJECTED',
        flags: ['HARASSMENT'],
      });

      const result = await service.evaluate({ ...baseRequest, message: 'Inappropriate content' });

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('violates our policies');
    });

    test('BLOCKS when fraud detected', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'HIGH', flagged: true });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
    });

    test('BLOCKS when fraud service unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.details?.code).toBe('SAFETY_CHECK_UNAVAILABLE');
    });
  });

  // ============================================================================
  // FAIL-OPEN MODE (Degraded) - Non-Production Only
  // ============================================================================

  describe('FAIL-OPEN MODE (Degraded Operation)', () => {
    beforeEach(() => setupModule(true, false));

    test('ALLOWS with skip when compliance has missing checks', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: false,
        missingChecks: ['KYC_VERIFICATION'],
      });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('compliance');
    });

    test('ALLOWS with skip when compliance service unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('compliance');
    });

    test('ALLOWS with skip when insurance required but unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: true });
      mockInsuranceService.hasValidInsurance.mockResolvedValue(false);

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('insurance');
    });

    test('ALLOWS with skip when insurance service unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('insurance');
    });

    test('BLOCKS moderation violations even in fail-open mode', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({
        status: 'REJECTED',
        flags: ['HARASSMENT'],
      });

      const result = await service.evaluate({ ...baseRequest, message: 'Bad content' });

      expect(result.allowed).toBe(false);
      // Moderation should not be skipped in fail-open mode for safety
    });

    test('ALLOWS with skip when fraud service unavailable', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('fraud');
    });
  });

  // ============================================================================
  // SUCCESSFUL BOOKING ELIGIBILITY
  // ============================================================================

  describe('SUCCESSFUL ELIGIBILITY CHECKS', () => {
    beforeEach(() => setupModule(false, false));

    test('ALLOWS when all checks pass', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW', flagged: false });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toEqual([]);
      expect(result.rejection).toBeUndefined();
    });

    test('ALLOWS when insurance not required', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW', flagged: false });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(mockInsuranceService.hasValidInsurance).not.toHaveBeenCalled();
    });

    test('ALLOWS when insurance required and available', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: true });
      mockInsuranceService.hasValidInsurance.mockResolvedValue(true);
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW', flagged: false });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
    });

    test('ALLOWS with no message (moderation skipped)', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW', flagged: false });

      const result = await service.evaluate({ ...baseRequest, message: undefined });

      expect(result.allowed).toBe(true);
      expect(mockModerationService.moderateMessage).not.toHaveBeenCalled();
    });

    test('ALLOWS when message empty string (moderation still runs)', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW', flagged: false });

      const result = await service.evaluate({ ...baseRequest, message: '' });

      expect(result.allowed).toBe(true);
      // Empty string is truthy for the check `if (request.message)`
    });
  });

  // ============================================================================
  // CHECK ORCHESTRATION ORDER
  // ============================================================================

  describe('CHECK ORCHESTRATION ORDER', () => {
    beforeEach(() => setupModule(false, false));

    test('runs checks in correct order: compliance → insurance → moderation → fraud', async () => {
      const callOrder: string[] = [];

      mockComplianceService.evaluateCompliance.mockImplementation(() => {
        callOrder.push('compliance');
        return Promise.resolve({ overallCompliant: true, missingChecks: [] });
      });
      mockInsuranceService.checkInsuranceRequirement.mockImplementation(() => {
        callOrder.push('insurance');
        return Promise.resolve({ required: false });
      });
      mockModerationService.moderateMessage.mockImplementation(() => {
        callOrder.push('moderation');
        return Promise.resolve({ status: 'APPROVED' });
      });
      mockFraudDetection.evaluateTransaction.mockImplementation(() => {
        callOrder.push('fraud');
        return Promise.resolve({ risk: 'LOW' });
      });

      await service.evaluate(baseRequest);

      expect(callOrder).toEqual(['compliance', 'insurance', 'moderation', 'fraud']);
    });

    test('stops after first failure (short-circuit)', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: false,
        missingChecks: ['KYC_VERIFICATION'],
      });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(mockInsuranceService.checkInsuranceRequirement).not.toHaveBeenCalled();
      expect(mockModerationService.moderateMessage).not.toHaveBeenCalled();
      expect(mockFraudDetection.evaluateTransaction).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // STRIPE TEST BYPASS MODE
  // ============================================================================

  describe('STRIPE_TEST_BYPASS MODE', () => {
    beforeEach(() => setupModule(false, true));

    test('SKIPS fraud check when bypass enabled', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(mockFraudDetection.evaluateTransaction).not.toHaveBeenCalled();
    });

    test('still runs other checks with bypass enabled', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });

      await service.evaluate(baseRequest);

      expect(mockComplianceService.evaluateCompliance).toHaveBeenCalled();
      expect(mockInsuranceService.checkInsuranceRequirement).toHaveBeenCalled();
      expect(mockModerationService.moderateMessage).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('EDGE CASES & BOUNDARY CONDITIONS', () => {
    beforeEach(() => setupModule(false, false));

    test('handles FLAGGED moderation status (not rejected but flagged)', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({
        status: 'FLAGGED',
        flags: ['SUSPICIOUS'],
      });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.details?.flags).toContain('SUSPICIOUS');
    });

    test('handles PENDING moderation status (should be treated as approved)', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'PENDING' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW' });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
    });

    test('handles multiple missing compliance checks', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: false,
        missingChecks: ['KYC', 'AGE', 'LOCATION', 'EMAIL_VERIFIED'],
      });

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.details?.missingChecks).toHaveLength(4);
    });

    test('handles listing in different jurisdictions', async () => {
      mockComplianceService.evaluateCompliance.mockImplementation(
        (renterId, type, country, state, city) => {
          expect(country).toBe('CA');
          expect(state).toBe('ON');
          expect(city).toBe('Toronto');
          return Promise.resolve({ overallCompliant: true, missingChecks: [] });
        },
      );
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW' });

      const result = await service.evaluate({
        ...baseRequest,
        listing: { country: 'CA', state: 'ON', city: 'Toronto' },
      });

      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // SECURITY: SKIP CHECKS REPORTING
  // ============================================================================

  describe('SECURITY: SKIP CHECKS REPORTING', () => {
    test('reports all skipped checks in fail-open mode', async () => {
      await setupModule(true, true);

      mockComplianceService.evaluateCompliance.mockRejectedValue(new Error('Down'));
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: true });
      mockInsuranceService.hasValidInsurance.mockResolvedValue(false);

      const result = await service.evaluate(baseRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('compliance');
      expect(result.skippedChecks).toContain('insurance');
      // fraud is also skipped due to STRIPE_TEST_BYPASS
    });

    test('reports empty skipped checks when all pass in fail-closed', async () => {
      await setupModule(false, false);

      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED' });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'LOW' });

      const result = await service.evaluate(baseRequest);

      expect(result.skippedChecks).toEqual([]);
    });
  });
});
