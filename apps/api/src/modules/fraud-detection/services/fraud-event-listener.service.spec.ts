import { FraudEventListenerService } from './fraud-event-listener.service';
import { RiskLevel } from './fraud-detection.service';

describe('FraudEventListenerService', () => {
  let service: FraudEventListenerService;
  let fraudService: any;
  let prisma: any;

  const lowRiskResult = {
    riskScore: 20,
    riskLevel: RiskLevel.LOW,
    flags: [],
    recommendation: 'ALLOW',
  };

  const highRiskResult = {
    riskScore: 75,
    riskLevel: RiskLevel.HIGH,
    flags: [{ type: 'DISPOSABLE_EMAIL', severity: 'HIGH', description: 'test' }],
    recommendation: 'REVIEW',
  };

  const criticalRiskResult = {
    riskScore: 95,
    riskLevel: RiskLevel.CRITICAL,
    flags: [{ type: 'SPAM_PATTERN', severity: 'CRITICAL', description: 'test' }],
    recommendation: 'BLOCK',
  };

  beforeEach(() => {
    fraudService = {
      checkUserRisk: jest.fn().mockResolvedValue(lowRiskResult),
      performListingFraudCheck: jest.fn().mockResolvedValue(lowRiskResult),
      checkPaymentRisk: jest.fn().mockResolvedValue(lowRiskResult),
    };

    prisma = {
      listing: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    service = new FraudEventListenerService(fraudService, prisma);
  });

  /* ─────────────────────────────────────────────────────────────────
   *  onUserRegistered
   * ───────────────────────────────────────────────────────────────── */
  describe('onUserRegistered', () => {
    const payload = { userId: 'user-1', email: 'user@example.com' };

    it('should call checkUserRisk with the given userId', async () => {
      await service.onUserRegistered(payload);
      expect(fraudService.checkUserRisk).toHaveBeenCalledWith('user-1');
    });

    it('should NOT create an audit log when risk score is below 70', async () => {
      fraudService.checkUserRisk.mockResolvedValue({ ...lowRiskResult, riskScore: 69 });
      await service.onUserRegistered(payload);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should create a HIGH_RISK_REGISTRATION audit log when risk score >= 70', async () => {
      fraudService.checkUserRisk.mockResolvedValue(highRiskResult);
      await service.onUserRegistered(payload);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'HIGH_RISK_REGISTRATION',
            entityType: 'User',
            entityId: 'user-1',
          }),
        }),
      );
    });

    it('should swallow errors and not rethrow', async () => {
      fraudService.checkUserRisk.mockRejectedValue(new Error('Fraud service down'));
      await expect(service.onUserRegistered(payload)).resolves.not.toThrow();
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  onListingCreated
   * ───────────────────────────────────────────────────────────────── */
  describe('onListingCreated', () => {
    const payload = { listingId: 'listing-1', ownerId: 'user-1' };

    const mockListing = {
      id: 'listing-1',
      title: 'Nice Apartment',
      description: 'A lovely place',
      basePrice: 100,
      photos: ['photo1.jpg'],
      ownerId: 'user-1',
      categoryId: 'cat-1',
    };

    it('should return early when listing is not found', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);
      await service.onListingCreated(payload);
      expect(fraudService.performListingFraudCheck).not.toHaveBeenCalled();
    });

    it('should call performListingFraudCheck with listing data', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      await service.onListingCreated(payload);
      expect(fraudService.performListingFraudCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          title: 'Nice Apartment',
          basePrice: 100,
        }),
      );
    });

    it('should warn when risk level is HIGH', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      fraudService.performListingFraudCheck.mockResolvedValue(highRiskResult);
      // Should complete without throwing
      await expect(service.onListingCreated(payload)).resolves.not.toThrow();
    });

    it('should warn when risk level is CRITICAL', async () => {
      prisma.listing.findUnique.mockResolvedValue(mockListing);
      fraudService.performListingFraudCheck.mockResolvedValue(criticalRiskResult);
      await expect(service.onListingCreated(payload)).resolves.not.toThrow();
    });

    it('should swallow errors and not rethrow', async () => {
      prisma.listing.findUnique.mockRejectedValue(new Error('DB error'));
      await expect(service.onListingCreated(payload)).resolves.not.toThrow();
    });
  });

  /* ─────────────────────────────────────────────────────────────────
   *  onPaymentProcessed
   * ───────────────────────────────────────────────────────────────── */
  describe('onPaymentProcessed', () => {
    const basePayload = {
      paymentId: 'pay-1',
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 500,
      currency: 'USD',
      status: 'COMPLETED',
    };

    it('should skip fraud check when payment status is not COMPLETED or SUCCEEDED', async () => {
      await service.onPaymentProcessed({ ...basePayload, status: 'PENDING' });
      expect(fraudService.checkPaymentRisk).not.toHaveBeenCalled();
    });

    it('should perform fraud check for COMPLETED payments', async () => {
      await service.onPaymentProcessed(basePayload);
      expect(fraudService.checkPaymentRisk).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          paymentMethodId: 'pay-1',
          amount: 500,
        }),
      );
    });

    it('should perform fraud check for SUCCEEDED payments', async () => {
      await service.onPaymentProcessed({ ...basePayload, status: 'SUCCEEDED' });
      expect(fraudService.checkPaymentRisk).toHaveBeenCalled();
    });

    it('should NOT create audit log when risk score is below 60', async () => {
      fraudService.checkPaymentRisk.mockResolvedValue({
        ...lowRiskResult,
        riskScore: 59,
      });
      await service.onPaymentProcessed(basePayload);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should create SUSPICIOUS_PAYMENT audit log when risk score >= 60', async () => {
      fraudService.checkPaymentRisk.mockResolvedValue({
        ...highRiskResult,
        riskScore: 60,
      });
      await service.onPaymentProcessed(basePayload);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'SUSPICIOUS_PAYMENT',
            entityType: 'Payment',
            entityId: 'pay-1',
          }),
        }),
      );
    });

    it('should swallow errors and not rethrow', async () => {
      fraudService.checkPaymentRisk.mockRejectedValue(new Error('Network error'));
      await expect(service.onPaymentProcessed(basePayload)).resolves.not.toThrow();
    });
  });
});
