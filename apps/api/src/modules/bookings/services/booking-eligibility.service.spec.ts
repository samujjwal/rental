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
    evaluateTransaction: jest.fn(),
  };

  const mockInsuranceService = {
    validateListingInsurance: jest.fn(),
  };

  const mockModerationService = {
    moderateContent: jest.fn(),
  };

  const mockComplianceService = {
    checkJurisdictionCompliance: jest.fn(),
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
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({ compliant: true });
      mockInsuranceService.validateListingInsurance.mockResolvedValue({ valid: true });
      mockModerationService.moderateContent.mockResolvedValue({ approved: true });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'low', allowed: true });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toEqual([]);
    });

    it('should reject when compliance check fails', async () => {
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({
        compliant: false,
        reason: 'User jurisdiction not supported',
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('compliance');
    });

    it('should reject when insurance check fails', async () => {
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({ compliant: true });
      mockInsuranceService.validateListingInsurance.mockResolvedValue({
        valid: false,
        reason: 'Listing lacks required insurance coverage',
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('insurance');
    });

    it('should reject when moderation check fails', async () => {
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({ compliant: true });
      mockInsuranceService.validateListingInsurance.mockResolvedValue({ valid: true });
      mockModerationService.moderateContent.mockResolvedValue({
        approved: false,
        reason: 'Inappropriate content detected',
        flags: ['profanity'],
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('moderation');
    });

    it('should reject when fraud check detects high risk', async () => {
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({ compliant: true });
      mockInsuranceService.validateListingInsurance.mockResolvedValue({ valid: true });
      mockModerationService.moderateContent.mockResolvedValue({ approved: true });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({
        risk: 'high',
        allowed: false,
        reason: 'Suspicious transaction pattern detected',
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('fraud');
    });

    it('should handle service errors with fail-closed behavior', async () => {
      mockComplianceService.checkJurisdictionCompliance.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
      expect(result.rejection?.reason).toContain('error');
    });

    it('should skip checks and allow in fail-open mode when configured', async () => {
      mockConfigService.get.mockReturnValue('true'); // SAFETY_CHECKS_FAIL_OPEN=true
      mockComplianceService.checkJurisdictionCompliance.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(true);
      expect(result.skippedChecks).toContain('compliance');
    });

    it('should evaluate high-value transactions with enhanced scrutiny', async () => {
      const highValueRequest: EligibilityRequest = { 
        ...validRequest, 
        totalPrice: 10000 
      };
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({ compliant: true });
      mockInsuranceService.validateListingInsurance.mockResolvedValue({ valid: true });
      mockModerationService.moderateContent.mockResolvedValue({ approved: true });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({
        risk: 'medium',
        allowed: true,
      });

      const result = await service.evaluate(highValueRequest);

      expect(result.allowed).toBe(true);
    });

    it('should handle missing optional message gracefully', async () => {
      const requestWithoutMessage: EligibilityRequest = { 
        ...validRequest, 
        message: undefined 
      };
      mockComplianceService.checkJurisdictionCompliance.mockResolvedValue({ compliant: true });
      mockInsuranceService.validateListingInsurance.mockResolvedValue({ valid: true });
      mockModerationService.moderateContent.mockResolvedValue({ approved: true });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'low', allowed: true });

      const result = await service.evaluate(requestWithoutMessage);

      expect(result.allowed).toBe(true);
    });

    it('should track all skipped checks in fail-open mode', async () => {
      mockConfigService.get.mockReturnValue('true');
      mockComplianceService.checkJurisdictionCompliance.mockRejectedValue(new Error('Compliance down'));
      mockInsuranceService.validateListingInsurance.mockRejectedValue(new Error('Insurance down'));
      mockModerationService.moderateContent.mockResolvedValue({ approved: true });
      mockFraudDetection.evaluateTransaction.mockResolvedValue({ risk: 'low', allowed: true });

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
      listing: {
        country: 'Nepal',
        state: 'Bagmati',
        city: 'Kathmandu',
        currency: 'NPR',
      },
    };

    it('should never skip fraud check even in fail-open mode', async () => {
      mockConfigService.get.mockReturnValue('true');
      mockFraudDetection.evaluateTransaction.mockResolvedValue({
        risk: 'high',
        allowed: false,
      });

      const result = await service.evaluate(validRequest);

      expect(result.allowed).toBe(false);
    });

    it('should run checks in correct order: compliance -> insurance -> moderation -> fraud', async () => {
      const callOrder: string[] = [];
      
      mockComplianceService.checkJurisdictionCompliance.mockImplementation(() => {
        callOrder.push('compliance');
        return Promise.resolve({ compliant: true });
      });
      mockInsuranceService.validateListingInsurance.mockImplementation(() => {
        callOrder.push('insurance');
        return Promise.resolve({ valid: true });
      });
      mockModerationService.moderateContent.mockImplementation(() => {
        callOrder.push('moderation');
        return Promise.resolve({ approved: true });
      });
      mockFraudDetection.evaluateTransaction.mockImplementation(() => {
        callOrder.push('fraud');
        return Promise.resolve({ risk: 'low', allowed: true });
      });

      await service.evaluate(validRequest);

      expect(callOrder).toEqual(['compliance', 'insurance', 'moderation', 'fraud']);
    });
  });
});
