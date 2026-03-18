import { InsuranceVerificationService } from './insurance-verification.service';

describe('InsuranceVerificationService', () => {
  let service: InsuranceVerificationService;
  let prisma: any;
  let cache: any;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    service = new InsuranceVerificationService(prisma, cache);
  });

  describe('queueVerification', () => {
    it('should create audit log entry with INSURANCE_VERIFICATION_QUEUED action', async () => {
      await service.queueVerification('policy-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'INSURANCE_VERIFICATION_QUEUED',
          }),
        }),
      );
    });
  });

  describe('getVerificationQueue', () => {
    it('should return only PENDING verifications from stored newValues payloads', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'a1', newValues: JSON.stringify({ status: 'PENDING' }) },
        { id: 'a2', newValues: JSON.stringify({ status: 'COMPLETED' }) },
        { id: 'a3', newValues: JSON.stringify({ status: 'PENDING' }) },
      ]);

      const queue = await service.getVerificationQueue();

      expect(queue).toHaveLength(2);
    });

    it('should fall back to metadata for legacy queue entries', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'a1', metadata: { status: 'PENDING' } },
        { id: 'a2', metadata: { status: 'COMPLETED' } },
      ]);

      const queue = await service.getVerificationQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('a1');
    });

    it('should return empty array when no pending items', async () => {
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'a1', newValues: JSON.stringify({ status: 'COMPLETED' }) },
      ]);

      const queue = await service.getVerificationQueue();

      expect(queue).toHaveLength(0);
    });
  });

  describe('runAutomatedChecks', () => {
    it('should flag policy not found when no audit log exists', async () => {
      prisma.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.runAutomatedChecks('missing-policy');

      expect(result.passed).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.flags).toContain('Policy not found');
    });

    it('should require manual verification for found policies', async () => {
      prisma.auditLog.findFirst.mockResolvedValue({
        id: 'audit-1',
        entityId: 'policy-1',
      });

      const result = await service.runAutomatedChecks('policy-1');

      expect(result.passed).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.flags).toContain('Manual verification required');
    });
  });

  describe('verifyProvider', () => {
    it('should return true for known providers', async () => {
      cache.get.mockResolvedValue(null); // Force cache miss

      const result = await service.verifyProvider('State Farm');

      expect(result).toBe(true);
    });

    it('should be case-insensitive', async () => {
      cache.get.mockResolvedValue(null);

      const result = await service.verifyProvider('state farm');

      expect(result).toBe(true);
    });

    it('should return false for unknown providers', async () => {
      cache.get.mockResolvedValue(null);

      const result = await service.verifyProvider('Unknown Insurance Co');

      expect(result).toBe(false);
    });

    it('should use cached providers when available', async () => {
      cache.get.mockResolvedValue(['TestProvider']);

      const result = await service.verifyProvider('TestProvider');

      expect(result).toBe(true);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('should cache providers on miss with 24h TTL', async () => {
      cache.get.mockResolvedValue(null);

      await service.verifyProvider('test');

      expect(cache.set).toHaveBeenCalledWith(
        'insurance:providers',
        expect.any(Array),
        86400,
      );
    });
  });

  describe('extractPolicyDetails', () => {
    it('should return empty object (placeholder)', async () => {
      const result = await service.extractPolicyDetails('https://example.com/doc.pdf');

      expect(result).toBeDefined();
    });
  });
});
