import { InsuranceController } from './insurance.controller';

describe('InsuranceController', () => {
  let controller: InsuranceController;
  let insuranceService: any;

  beforeEach(() => {
    insuranceService = {
      checkInsuranceRequirement: jest.fn().mockResolvedValue({
        required: true,
        minimumCoverage: 100000,
      }),
      uploadInsurancePolicy: jest.fn().mockResolvedValue({ id: 'pol-1' }),
      verifyInsurancePolicy: jest.fn().mockResolvedValue({ verified: true }),
      getInsuranceStatus: jest.fn().mockResolvedValue({
        listingId: 'l-1',
        hasValidInsurance: true,
      }),
      hasValidInsurance: jest.fn().mockResolvedValue(true),
      getExpiringPolicies: jest.fn().mockResolvedValue([]),
      generateCertificate: jest.fn().mockResolvedValue({
        certificateUrl: 'https://example.com/cert.pdf',
      }),
    };

    controller = new InsuranceController(insuranceService, {} as any);
  });

  describe('checkRequirement', () => {
    it('should return insurance requirement for listing', async () => {
      const result = await controller.checkRequirement('listing-1');

      expect(result).toBeDefined();
      expect(insuranceService.checkInsuranceRequirement).toHaveBeenCalledWith('listing-1');
    });
  });

  describe('uploadPolicy', () => {
    it('should upload insurance policy', async () => {
      const dto = {
        listingId: 'listing-1',
        policyNumber: 'POL-123',
        provider: 'Sagarmatha Insurance',
        type: 'liability',
        coverageAmount: 100000,
        effectiveDate: '2025-01-01',
        expirationDate: '2026-01-01',
        documentUrl: 'https://example.com/doc.pdf',
      };
      const result = await controller.uploadPolicy('user-1', dto as any);

      expect(result).toBeDefined();
      expect(insuranceService.uploadInsurancePolicy).toHaveBeenCalled();
    });
  });

  describe('verifyPolicy', () => {
    it('should verify insurance policy', async () => {
      const result = await controller.verifyPolicy('pol-1', 'admin-1', true);

      expect(result).toEqual({ success: true });
      expect(insuranceService.verifyInsurancePolicy).toHaveBeenCalled();
    });

    it('should reject with notes', async () => {
      await controller.verifyPolicy('pol-1', 'admin-1', false, 'Invalid document');

      expect(insuranceService.verifyInsurancePolicy).toHaveBeenCalled();
    });
  });

  describe('getInsuranceStatus', () => {
    it('should return insurance status for listing', async () => {
      const result = await controller.getInsuranceStatus('listing-1');

      expect(result).toEqual({ listingId: 'listing-1', hasValidInsurance: true });
      expect(insuranceService.hasValidInsurance).toHaveBeenCalledWith('listing-1');
    });
  });

  describe('getExpiringPolicies', () => {
    it('should return expiring policies', async () => {
      const result = await controller.getExpiringPolicies();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass days parameter', async () => {
      await controller.getExpiringPolicies(30);

      expect(insuranceService.getExpiringPolicies).toHaveBeenCalled();
    });
  });

  describe('generateCertificate', () => {
    it('should generate insurance certificate', async () => {
      const result = await controller.generateCertificate('pol-1');

      expect(result).toBeDefined();
      expect(insuranceService.generateCertificate).toHaveBeenCalledWith('pol-1');
    });
  });
});
