import { Test, TestingModule } from '@nestjs/testing';
import { BookingEligibilityService } from './booking-eligibility.service';
import { FraudDetectionService } from '@/modules/fraud-detection/services/fraud-detection.service';
import { InsuranceService } from '@/modules/insurance/services/insurance.service';
import { ContentModerationService } from '@/modules/moderation/services/content-moderation.service';
import { ComplianceService } from '@/modules/compliance/compliance.service';
import { ConfigService } from '@nestjs/config';
import type { EligibilityRequest } from '../ports/booking-eligibility.port';

describe('BookingEligibilityService', () => {
  let service: BookingEligibilityService;
  let fraudDetection: jest.Mocked<FraudDetectionService>;
  let insuranceService: jest.Mocked<InsuranceService>;
  let moderationService: jest.Mocked<ContentModerationService>;
  let complianceService: jest.Mocked<ComplianceService>;
  let configService: jest.Mocked<ConfigService>;

  const mockFraudDetection = {
    performBookingFraudCheck: jest.fn(),
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

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingEligibilityService,
        { provide: FraudDetectionService, useValue: mockFraudDetection },
        { provide: InsuranceService, useValue: mockInsuranceService },
        { provide: ContentModerationService, useValue: mockModerationService },
        { provide: ComplianceService, useValue: mockComplianceService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BookingEligibilityService>(BookingEligibilityService);
    fraudDetection = module.get(FraudDetectionService);
    insuranceService = module.get(InsuranceService);
    moderationService = module.get(ContentModerationService);
    complianceService = module.get(ComplianceService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('false'); // SAFETY_CHECKS_FAIL_OPEN=false by default
  });

  describe('evaluate', () => {
    const validRequest: EligibilityRequest = {
      renterId: 'renter-123',
      listingId: 'listing-456',
      startDate: new Date('2025-12-10'),
      endDate: new Date('2025-12-15'),
      totalPrice: 500,
      message: 'Looking forward to the rental!',
      listing: {
        country: 'Nepal',
        state: 'Bagmati',
        city: 'Kathmandu',
        currency: 'NPR',
      },
    };

    it('should return allowed when all checks pass', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED', flags: [] });
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: true,
        riskScore: 10,
        flags: [],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toEqual([]);
    });

    it('should reject when compliance check fails', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: false,
        missingChecks: ['identity_verification'],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('Compliance');
    });

    it('should reject when insurance check fails', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({
        required: true,
        reason: 'High value listing',
      });
      mockInsuranceService.hasValidInsurance.mockResolvedValue(false);

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('Insurance');
    });

    it('should reject when moderation check fails', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({
        status: 'REJECTED',
        flags: ['profanity'],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('content');
    });

    it('should reject when fraud check detects high risk', async () => {
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED', flags: [] });
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: false,
        riskScore: 85,
        flags: [{ type: 'velocity' }],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
    });

    it('should handle service errors with fail-closed behavior', async () => {
      mockComplianceService.evaluateCompliance.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('compliance');
    });

    it('should skip checks and allow in fail-open mode when configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SAFETY_CHECKS_FAIL_OPEN') return 'true';
        if (key === 'STRIPE_TEST_BYPASS') return 'false';
        return 'false';
      });
      mockComplianceService.evaluateCompliance.mockRejectedValue(new Error('Service unavailable'));
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED', flags: [] });
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: true,
        riskScore: 10,
        flags: [],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('compliance');
    });

    it('should evaluate high-value transactions with enhanced scrutiny', async () => {
      const highValueRequest: EligibilityRequest = {
        ...validRequest,
        totalPrice: 10000,
      };
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockModerationService.moderateMessage.mockResolvedValue({ status: 'APPROVED', flags: [] });
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: true,
        riskScore: 50,
        flags: [{ type: 'value' }],
      });

      const result = await service.evaluate(highValueRequest);

      expect(result.allowed).toBe(true);
    });

    it('should handle missing optional message gracefully', async () => {
      const requestWithoutMessage: EligibilityRequest = {
        ...validRequest,
        message: undefined,
      };
      mockComplianceService.evaluateCompliance.mockResolvedValue({
        overallCompliant: true,
        missingChecks: [],
      });
      mockInsuranceService.checkInsuranceRequirement.mockResolvedValue({ required: false });
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: true,
        riskScore: 10,
        flags: [],
      });

      const result = await service.evaluate(requestWithoutMessage);

      expect(result.allowed).toBe(true);
    });

    it('should track all skipped checks in fail-open mode', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SAFETY_CHECKS_FAIL_OPEN') return 'true';
        return 'false';
      });
      mockComplianceService.evaluateCompliance.mockRejectedValue(new Error('Compliance down'));
      mockInsuranceService.checkInsuranceRequirement.mockRejectedValue(new Error('Insurance down'));
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: true,
        riskScore: 10,
        flags: [],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('compliance');
      expect(result.skippedChecks).toContain('insurance');
    });
  });

  describe('critical safety checks', () => {
    const validRequest: EligibilityRequest = {
      renterId: 'renter-123',
      listingId: 'listing-456',
      startDate: new Date('2025-12-10'),
      endDate: new Date('2025-12-15'),
      totalPrice: 500,
      message: 'Test message for moderation',
      listing: {
        country: 'Nepal',
        state: 'Bagmati',
        city: 'Kathmandu',
        currency: 'NPR',
      },
    };

    it('should never skip fraud check even in fail-open mode', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SAFETY_CHECKS_FAIL_OPEN') return 'true';
        return 'false';
      });
      mockFraudDetection.performBookingFraudCheck.mockResolvedValue({
        allowBooking: false,
        riskScore: 85,
        flags: [{ type: 'suspicious' }],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
    });

    it('should run checks in correct order: compliance -> insurance -> moderation -> fraud', async () => {
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
        return Promise.resolve({ status: 'APPROVED', flags: [] });
      });
      mockFraudDetection.performBookingFraudCheck.mockImplementation(() => {
        callOrder.push('fraud');
        return Promise.resolve({ allowBooking: true, riskScore: 10, flags: [] });
      });

      await service.evaluate(validRequest);

      expect(callOrder).toEqual(['compliance', 'insurance', 'moderation', 'fraud']);
    });
  });
});
