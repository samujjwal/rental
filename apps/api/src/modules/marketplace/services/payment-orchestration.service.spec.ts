import { Test, TestingModule } from '@nestjs/testing';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('PaymentOrchestrationService', () => {
  let service: PaymentOrchestrationService;
  let prisma: any;
  let eventEmitter: any;

  beforeAll(() => {
    // eSewa, Khalti, Razorpay, Bkash plugins require env vars to initialize
    process.env.ESEWA_MERCHANT_CODE = 'test-merchant';
    process.env.ESEWA_SECRET_KEY = 'test-secret-key';
    process.env.ESEWA_API_URL = 'https://uat.esewa.com.np';
    process.env.KHALTI_PUBLIC_KEY = 'test-pub';
    process.env.KHALTI_SECRET_KEY = 'test-sec';
    process.env.KHALTI_API_URL = 'https://a.khalti.com';
    process.env.RAZORPAY_KEY_ID = 'test-key';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    process.env.BKASH_APP_KEY = 'test-key';
    process.env.BKASH_APP_SECRET = 'test-secret';
    process.env.BKASH_USERNAME = 'test-user';
    process.env.BKASH_PASSWORD = 'test-pass';
    process.env.BKASH_API_URL = 'https://tokenized.sandbox.bka.sh';
  });

  afterAll(() => {
    delete process.env.ESEWA_MERCHANT_CODE;
    delete process.env.ESEWA_SECRET_KEY;
    delete process.env.ESEWA_API_URL;
    delete process.env.KHALTI_PUBLIC_KEY;
    delete process.env.KHALTI_SECRET_KEY;
    delete process.env.KHALTI_API_URL;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.BKASH_APP_KEY;
    delete process.env.BKASH_APP_SECRET;
    delete process.env.BKASH_USERNAME;
    delete process.env.BKASH_PASSWORD;
    delete process.env.BKASH_API_URL;
  });

  beforeEach(async () => {
    prisma = {
      paymentProvider: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      escrowTransaction: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'esc-1', ...data })),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      ledgerEntry: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'le-1', ...data })),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentOrchestrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn(), setNx: jest.fn().mockResolvedValue(true) } },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PaymentOrchestrationService>(PaymentOrchestrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRegisteredProviders', () => {
    it('should have default providers registered', () => {
      const providers = service.getRegisteredProviders();
      expect(providers).toContain('esewa');
      expect(providers).toContain('khalti');
      expect(providers).toContain('razorpay');
      expect(providers).toContain('bkash');
    });
  });

  describe('selectProvider', () => {
    it('should select esewa for NPR', async () => {
      const provider = await service.selectProvider('NP', 'NPR');
      expect(provider).toBe('esewa');
    });

    it('should select razorpay for USD', async () => {
      const provider = await service.selectProvider('US', 'USD');
      expect(provider).toBe('razorpay');
    });

    it('should select razorpay for INR', async () => {
      const provider = await service.selectProvider('IN', 'INR');
      expect(provider).toBe('razorpay');
    });

    it('should select bkash for BDT', async () => {
      const provider = await service.selectProvider('BD', 'BDT');
      expect(provider).toBe('bkash');
    });
  });

  describe('authorize', () => {
    it('should authorize a payment and emit event', async () => {
      const result = await service.authorize({
        amount: 5000,
        currency: 'NPR',
        country: 'NP',
        userId: 'user-1',
        bookingId: 'booking-1',
      });
      expect(result).toBeDefined();
      expect(result.transactionId).toBeDefined();
      // eSewa returns 'pending_redirect' because it requires client-side redirect
      expect(result.status).toBe('pending_redirect');
      expect(result.provider).toBe('esewa');
      expect(eventEmitter.emit).toHaveBeenCalledWith('payment.authorized', expect.any(Object));
    });
  });

  describe('capture', () => {
    it('should attempt capture and return status', async () => {
      // Real eSewa plugin calls external API, which will fail without credentials
      // but should not throw — it returns a status
      const result = await service.capture('tx-123', 5000, 'esewa');
      expect(result.status).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('payment.captured', expect.any(Object));
    });

    it('should throw for unknown provider', async () => {
      await expect(service.capture('tx-123', 5000, 'nonexistent')).rejects.toThrow();
    });
  });

  describe('refund', () => {
    it('should create a refund request', async () => {
      const result = await service.refund('tx-123', 5000, 'esewa', 'Cancelled');
      // eSewa refunds are manual, so status is 'pending_manual_processing'
      expect(result.status).toBe('pending_manual_processing');
      expect(result.refundId).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('payment.refunded', expect.any(Object));
    });
  });

  describe('payout', () => {
    it('should payout to host', async () => {
      const result = await service.payout({
        recipientId: 'host-1',
        amount: 4500,
        currency: 'NPR',
        country: 'NP',
      });
      expect(result).toBeDefined();
      expect(result.payoutId).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('payment.payout', expect.any(Object));
    });
  });

  describe('getProviderHealth', () => {
    it('should return health status of providers', async () => {
      const health = await service.getProviderHealth();
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThanOrEqual(3);
    });
  });
});
