import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DepositStatus, BookingStatus } from '@rental-portal/database';
import Stripe from 'stripe';

jest.mock('stripe', () => {
  // Preserve real Stripe error classes so instanceof checks work
  const ActualStripe = jest.requireActual('stripe');
  const MockStripeConstructor = jest.fn().mockImplementation(() => ({
    accounts: { create: jest.fn(), retrieve: jest.fn() },
    accountLinks: { create: jest.fn() },
    paymentIntents: { create: jest.fn(), capture: jest.fn(), cancel: jest.fn() },
    refunds: { create: jest.fn() },
    payouts: { create: jest.fn() },
    customers: { create: jest.fn(), update: jest.fn() },
    paymentMethods: { attach: jest.fn(), list: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  }));
  // Copy over static properties (especially errors)
  Object.assign(MockStripeConstructor, ActualStripe.default || ActualStripe);
  return { __esModule: true, default: MockStripeConstructor };
});

describe('StripeService', () => {
  let service: StripeService;
  let prisma: PrismaService;

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
      return null;
    }),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(), // fixed: update instead of updateMany for user
      updateMany: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    depositHold: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PaymentProvider interface compliance', () => {
    it('should have providerId set to stripe', () => {
      expect(service.providerId).toBe('stripe');
    });

    it('should expose a config getter with supported countries', () => {
      expect(service.config).toBeDefined();
      expect(service.config.providerId).toBe('stripe');
      expect(service.config.supportedCountries).toContain('US');
      expect(service.config.supportedCurrencies).toContain('USD');
      expect(service.config.name).toBe('Stripe');
    });
  });

  describe('createConnectAccount', () => {
    it('should return existing stripeConnectId if present', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ stripeConnectId: 'acct_existing' });
      const res = await service.createConnectAccount('u1', 'test@example.com');
      expect(res).toBe('acct_existing');
    });

    it('should create new account if missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ stripeConnectId: null });
      const stripeInstance = (service as any).stripe;
      stripeInstance.accounts.create.mockResolvedValue({ id: 'acct_new' });

      const res = await service.createConnectAccount('u1', 'test@example.com');

      expect(stripeInstance.accounts.create).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { stripeConnectId: 'acct_new' },
      });
      expect(res).toBe('acct_new');
    });
  });

  describe('holdDeposit', () => {
    it('should create deposit hold', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        id: 'b1',
        renter: { stripeCustomerId: 'cus_123' },
      });

      // No existing hold — allow proceeding to Stripe
      mockPrismaService.depositHold.findFirst.mockResolvedValue(null);

      const stripeInstance = (service as any).stripe;
      stripeInstance.paymentIntents.create.mockResolvedValue({ id: 'pi_deposit' });

      mockPrismaService.depositHold.create.mockResolvedValue({ id: 'dh_1' });

      const res = await service.holdDeposit('b1', 500, 'USD');

      // Implementation now calls paymentIntents.create with two args:
      //   1. payment intent params (amount, currency, customer, capture_method, metadata)
      //   2. Stripe request options with idempotencyKey — prevents double-charge on retry
      expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          customer: 'cus_123',
          capture_method: 'manual',
        }),
        expect.objectContaining({
          idempotencyKey: 'deposit_hold_b1',
        }),
      );
      expect(prisma.depositHold.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DepositStatus.AUTHORIZED,
          }),
        }),
      );
      expect(res).toBe('pi_deposit');
    });
  });

  describe('releaseDeposit', () => {
    it('should cancel payment intent and update status', async () => {
      mockPrismaService.depositHold.findUnique.mockResolvedValue({
        id: 'dh_1',
        status: DepositStatus.AUTHORIZED,
        paymentIntentId: 'pi_deposit',
      });

      const stripeInstance = (service as any).stripe;
      stripeInstance.paymentIntents.cancel.mockResolvedValue({});

      await service.releaseDeposit('dh_1');

      expect(stripeInstance.paymentIntents.cancel).toHaveBeenCalledWith('pi_deposit');
      expect(prisma.depositHold.update).toHaveBeenCalledWith({
        where: { id: 'dh_1' },
        data: expect.objectContaining({ status: DepositStatus.RELEASED }),
      });
    });
  });

  describe('handleStripeError — error mapping via createAccountLink', () => {
    // We test the private handleStripeError method indirectly through createAccountLink
    // which wraps its Stripe call in try/catch and delegates to handleStripeError.

    it('should throw BadRequestException for StripeCardError', async () => {
      const stripeInstance = (service as any).stripe;
      const cardError = new Stripe.errors.StripeCardError({
        message: 'Your card was declined',
        type: 'card_error',
      } as any);
      stripeInstance.accountLinks.create.mockRejectedValueOnce(cardError);

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse();
        expect(response.code).toBe('CARD_ERROR');
      }
    });

    it('should throw BadRequestException for StripeInvalidRequestError', async () => {
      const stripeInstance = (service as any).stripe;
      const invalidReqError = new Stripe.errors.StripeInvalidRequestError({
        message: 'Invalid account',
        type: 'invalid_request_error',
      } as any);
      stripeInstance.accountLinks.create.mockRejectedValueOnce(invalidReqError);

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected BadRequestException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse();
        expect(response.code).toBe('INVALID_REQUEST');
      }
    });

    it('should throw InternalServerErrorException for StripeRateLimitError', async () => {
      const stripeInstance = (service as any).stripe;
      const rateLimitError = new Stripe.errors.StripeRateLimitError({
        message: 'Too many requests',
        type: 'rate_limit_error',
      } as any);
      stripeInstance.accountLinks.create.mockRejectedValueOnce(rateLimitError);

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected InternalServerErrorException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        const response = error.getResponse();
        expect(response.code).toBe('RATE_LIMIT');
      }
    });

    it('should throw InternalServerErrorException for StripeAuthenticationError', async () => {
      const stripeInstance = (service as any).stripe;
      const authError = new Stripe.errors.StripeAuthenticationError({
        message: 'Invalid API key',
        type: 'authentication_error',
      } as any);
      stripeInstance.accountLinks.create.mockRejectedValueOnce(authError);

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected InternalServerErrorException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        const response = error.getResponse();
        expect(response.code).toBe('AUTH_ERROR');
      }
    });

    it('should throw InternalServerErrorException for StripeConnectionError', async () => {
      const stripeInstance = (service as any).stripe;
      const connError = new Stripe.errors.StripeConnectionError({
        message: 'Network error',
        type: 'api_connection_error',
      } as any);
      stripeInstance.accountLinks.create.mockRejectedValueOnce(connError);

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected InternalServerErrorException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        const response = error.getResponse();
        expect(response.code).toBe('CONNECTION_ERROR');
      }
    });

    it('should throw InternalServerErrorException for StripeAPIError', async () => {
      const stripeInstance = (service as any).stripe;
      const apiError = new Stripe.errors.StripeAPIError({
        message: 'Internal server error',
        type: 'api_error',
      } as any);
      stripeInstance.accountLinks.create.mockRejectedValueOnce(apiError);

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected InternalServerErrorException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        const response = error.getResponse();
        expect(response.code).toBe('API_ERROR');
      }
    });

    it('should throw InternalServerErrorException for unknown errors', async () => {
      const stripeInstance = (service as any).stripe;
      stripeInstance.accountLinks.create.mockRejectedValueOnce(new Error('Something broke'));

      try {
        await service.createAccountLink('acct_1', 'http://return', 'http://refresh');
        fail('Expected InternalServerErrorException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
      }
    });
  });
});
