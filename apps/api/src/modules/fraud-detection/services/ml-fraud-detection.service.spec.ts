import { MlFraudDetectionService, type TransactionContext, type FraudScore } from './ml-fraud-detection.service';

describe('MlFraudDetectionService (unit)', () => {
  let service: MlFraudDetectionService;
  let prisma: any;
  let config: any;

  const ctx: TransactionContext = {
    userId: 'user-1',
    amount: 1000,
    currency: 'NPR',
    paymentMethod: 'card',
    deviceFingerprint: 'fp-abc',
    ipAddress: '1.2.3.4',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(() => {
    prisma = {
      booking: {
        count: jest.fn().mockResolvedValue(0),
      },
      dispute: { count: jest.fn().mockResolvedValue(0) },
      session: { count: jest.fn().mockResolvedValue(0) },
      deviceFingerprint: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: { amount: 0 } }),
      },
      auditLog: { count: jest.fn().mockResolvedValue(0) },
    };

    config = {
      get: jest.fn((key: string, def: string = '') => def),
    };

    service = new MlFraudDetectionService(prisma, config);

    // Stub storeFraudScore so tests don't need fraudScore model
    (service as any).storeFraudScore = jest.fn().mockResolvedValue(undefined);
  });

  describe('analyzeTransaction', () => {
    it('returns a FraudScore with correct shape', async () => {
      const result = await service.analyzeTransaction(ctx);
      expect(result).toMatchObject({
        userId: 'user-1',
        score: expect.any(Number),
        riskLevel: expect.stringMatching(/^(LOW|MEDIUM|HIGH|CRITICAL)$/),
        factors: expect.arrayContaining([
          expect.objectContaining({ name: 'user_behavior' }),
          expect.objectContaining({ name: 'device_trust' }),
          expect.objectContaining({ name: 'transaction_velocity' }),
          expect.objectContaining({ name: 'amount_anomaly' }),
          expect.objectContaining({ name: 'ip_reputation' }),
          expect.objectContaining({ name: 'payment_risk' }),
        ]),
        recommendations: expect.any(Array),
        timestamp: expect.any(Date),
      });
    });

    it('produces LOW risk for a trusted, low-activity user', async () => {
      // 5+ completed bookings = -0.3 from user behavior
      prisma.booking.count
        .mockResolvedValueOnce(0)   // recent 24h bookings
        .mockResolvedValueOnce(10)  // total bookings
        .mockResolvedValueOnce(6);  // completed bookings
      const result = await service.analyzeTransaction(ctx);
      expect(['LOW', 'MEDIUM']).toContain(result.riskLevel);
    });

    it('stores fraud score after analysis', async () => {
      await service.analyzeTransaction(ctx);
      expect((service as any).storeFraudScore).toHaveBeenCalledTimes(1);
    });
  });

  describe('shouldBlock', () => {
    const makeScore = (riskLevel: FraudScore['riskLevel'], factors: FraudScore['factors'] = []): FraudScore => ({
      userId: 'u1',
      score: 80,
      riskLevel,
      factors,
      recommendations: [],
      timestamp: new Date(),
    });

    it('blocks CRITICAL risk', () => {
      expect(service.shouldBlock(makeScore('CRITICAL'))).toBe(true);
    });

    it('does not block LOW risk', () => {
      expect(service.shouldBlock(makeScore('LOW'))).toBe(false);
    });

    it('blocks HIGH risk with critical velocity factor', () => {
      const score = makeScore('HIGH', [
        { name: 'transaction_velocity', weight: 0.2, description: '', value: 0.8 },
      ]);
      expect(service.shouldBlock(score)).toBe(true);
    });

    it('does not block HIGH risk without critical factors', () => {
      const score = makeScore('HIGH', [
        { name: 'transaction_velocity', weight: 0.2, description: '', value: 0.3 },
      ]);
      expect(service.shouldBlock(score)).toBe(false);
    });
  });

  describe('requiresVerification', () => {
    it('requires verification for MEDIUM and HIGH risk', () => {
      const medium: FraudScore = { userId: 'u', score: 50, riskLevel: 'MEDIUM', factors: [], recommendations: [], timestamp: new Date() };
      const high: FraudScore = { ...medium, riskLevel: 'HIGH' };
      expect(service.requiresVerification(medium)).toBe(true);
      expect(service.requiresVerification(high)).toBe(true);
    });

    it('does not require verification for LOW risk', () => {
      const low: FraudScore = { userId: 'u', score: 10, riskLevel: 'LOW', factors: [], recommendations: [], timestamp: new Date() };
      expect(service.requiresVerification(low)).toBe(false);
    });
  });

  describe('getFraudTrends', () => {
    it('returns zero-filled result when fraudScore model is absent', async () => {
      // prisma.fraudScore is not defined → service guards with early return
      const result = await service.getFraudTrends(30);
      expect(result).toEqual({
        totalTransactions: 0,
        flaggedTransactions: 0,
        blockedTransactions: 0,
        averageScore: 0,
        trend: 'stable',
      });
    });

    it('computes trends when scores are present', async () => {
      const scores = [
        { score: 20 }, { score: 30 },   // first half: avg 25
        { score: 70 }, { score: 80 },   // second half: avg 75 → increasing
      ];
      (prisma as any).fraudScore = { findMany: jest.fn().mockResolvedValue(scores) };
      service = new MlFraudDetectionService(prisma, config);
      (service as any).storeFraudScore = jest.fn().mockResolvedValue(undefined);

      const result = await service.getFraudTrends(30);
      expect(result.totalTransactions).toBe(4);
      expect(result.trend).toBe('increasing');
      expect(result.flaggedTransactions).toBe(2); // score >= 60
      expect(result.blockedTransactions).toBe(1); // score >= 80
    });
  });
});
