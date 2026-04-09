import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, DepositStatus } from '@rental-portal/database';
import Stripe from 'stripe';

/**
 * STRIPE INTEGRATION TESTS
 * 
 * These tests validate the integration with Stripe for payment processing:
 * 1. Payment intent creation with test card numbers
 * 2. Deposit hold and capture/release
 * 3. Refund processing
 * 4. Connect account payouts
 * 5. Customer management
 * 6. Error handling with Stripe test cards
 * 
 * Test Cards Used (from https://docs.stripe.com/testing):
 * - 4242424242424242: Visa (successful payment)
 * - 4000000000000002: Card declined (generic_decline)
 * - 4000000000009995: Insufficient funds
 * - 4000000000009979: Lost card
 * - 4000000000009987: Stolen card
 * - 4000000000000069: Expired card
 * - 4000000000000127: Incorrect CVC
 * - 4000000000000119: Processing error
 * - 4000000000000036: Incorrect number
 * 
 * Note: These tests use mocked Stripe SDK to avoid requiring actual Stripe credentials.
 * For E2E tests with real Stripe, use Stripe test mode with test API keys.
 */
describe('Stripe Integration Tests', () => {
  let stripeService: StripeService;
  let prisma: any;
  let configService: any;
  let stripeClient: any;

  // Stripe test card numbers from documentation
  const TEST_CARDS = {
    visaSuccess: '4242424242424242',
    genericDecline: '4000000000000002',
    insufficientFunds: '4000000000009995',
    lostCard: '4000000000009979',
    stolenCard: '4000000000009987',
    expiredCard: '4000000000000069',
    incorrectCvc: '4000000000000127',
    processingError: '4000000000000119',
    incorrectNumber: '4000000000000036',
  };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paymentIntent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      payout: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      depositHold: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
        if (key === 'STRIPE_TEST_BYPASS') return 'false';
        if (key === 'nodeEnv') return 'test';
        return undefined;
      }),
    };

    // Mock Stripe client
    stripeClient = {
      paymentIntents: {
        create: jest.fn(),
        capture: jest.fn(),
        retrieve: jest.fn(),
        cancel: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      payouts: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      accounts: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      accountLinks: {
        create: jest.fn(),
      },
      customers: {
        create: jest.fn(),
        update: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    stripeService = module.get<StripeService>(StripeService);

    // Replace the internal Stripe client with our mock
    (stripeService as any).stripe = stripeClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PAYMENT INTENT CREATION', () => {
    it('should create payment intent with booking ID and amount', async () => {
      const bookingData = {
        id: 'booking-1',
        renterId: 'renter-1',
        listingId: 'listing-1',
        totalPrice: 1000,
        currency: 'USD',
        status: BookingStatus.PENDING_PAYMENT,
        listing: {
          owner: { id: 'owner-1' },
        },
      };

      prisma.booking.findUnique.mockResolvedValue(bookingData);
      stripeClient.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret_xyz',
        amount: 100000,
        currency: 'usd',
        status: 'requires_payment_method',
      });

      const result = await stripeService.createPaymentIntent('booking-1', 1000, 'USD');

      expect(result.paymentIntentId).toBe('pi_123');
      expect(result.clientSecret).toBe('pi_123_secret_xyz');
      expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100000,
          currency: 'usd',
          metadata: expect.objectContaining({
            bookingId: 'booking-1',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should create payment intent with params object', async () => {
      const bookingData = {
        id: 'booking-1',
        renterId: 'renter-1',
        listingId: 'listing-1',
        totalPrice: 1000,
        currency: 'USD',
        status: BookingStatus.PENDING_PAYMENT,
        listing: {
          owner: { id: 'owner-1' },
        },
      };

      prisma.booking.findUnique.mockResolvedValue(bookingData);
      stripeClient.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'pi_123_secret_xyz',
        amount: 100000,
        currency: 'usd',
        status: 'requires_payment_method',
      });

      const result = await stripeService.createPaymentIntent({
        bookingId: 'booking-1',
        amount: 1000,
        currency: 'USD',
        customerId: 'cus_123',
      });

      expect(result.paymentIntentId).toBe('pi_123');
      expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
        }),
        expect.any(Object),
      );
    });

    it('should reject payment intent with zero or negative amount', async () => {
      await expect(stripeService.createPaymentIntent('booking-1', 0, 'USD')).rejects.toThrow(
        BadRequestException,
      );
      await expect(stripeService.createPaymentIntent('booking-1', -100, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject payment intent without currency', async () => {
      await expect(stripeService.createPaymentIntent('booking-1', 1000, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw not found when booking does not exist', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('DEPOSIT HOLD', () => {
    it('should create deposit hold with manual capture method', async () => {
      const bookingData = {
        id: 'booking-1',
        renterId: 'renter-1',
        listingId: 'listing-1',
        currency: 'USD',
        renter: {
          stripeCustomerId: 'cus_123',
        },
      };

      prisma.booking.findUnique.mockResolvedValue(bookingData);
      prisma.depositHold.findFirst.mockResolvedValue(null);
      stripeClient.paymentIntents.create.mockResolvedValue({
        id: 'pi_deposit_123',
        amount: 20000,
        currency: 'usd',
        status: 'requires_payment_method',
      });
      prisma.depositHold.create.mockResolvedValue({ id: 'hold-1' });

      const result = await stripeService.holdDeposit('booking-1', 200, 'USD');

      expect(result).toBe('pi_deposit_123');
      expect(stripeClient.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 20000,
          currency: 'usd',
          customer: 'cus_123',
          capture_method: 'manual',
          metadata: expect.objectContaining({
            type: 'deposit',
            bookingId: 'booking-1',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should return existing deposit hold if already exists', async () => {
      const bookingData = {
        id: 'booking-1',
        renterId: 'renter-1',
        listingId: 'listing-1',
        currency: 'USD',
        renter: {
          stripeCustomerId: 'cus_123',
        },
      };

      prisma.booking.findUnique.mockResolvedValue(bookingData);
      prisma.depositHold.findFirst.mockResolvedValue({
        id: 'hold-1',
        paymentIntentId: 'pi_existing_123',
        status: DepositStatus.AUTHORIZED,
      });

      const result = await stripeService.holdDeposit('booking-1', 200, 'USD');

      expect(result).toBe('pi_existing_123');
      expect(stripeClient.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('should reject deposit hold with zero or negative amount', async () => {
      await expect(stripeService.holdDeposit('booking-1', 0, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('DEPOSIT RELEASE', () => {
    it('should cancel payment intent to release deposit', async () => {
      const depositData = {
        id: 'hold-1',
        bookingId: 'booking-1',
        paymentIntentId: 'pi_deposit_123',
        status: DepositStatus.AUTHORIZED,
      };

      prisma.depositHold.findUnique.mockResolvedValue(depositData);
      stripeClient.paymentIntents.cancel.mockResolvedValue({});
      prisma.depositHold.update.mockResolvedValue({ id: 'hold-1' });

      await stripeService.releaseDeposit('hold-1');

      expect(stripeClient.paymentIntents.cancel).toHaveBeenCalledWith('pi_deposit_123');
      expect(prisma.depositHold.update).toHaveBeenCalledWith({
        where: { id: 'hold-1' },
        data: expect.objectContaining({
          status: DepositStatus.RELEASED,
          releasedAt: expect.any(Date),
        }),
      });
    });

    it('should reject release for non-authorized deposit', async () => {
      const depositData = {
        id: 'hold-1',
        paymentIntentId: 'pi_deposit_123',
        status: DepositStatus.CAPTURED,
      };

      prisma.depositHold.findUnique.mockResolvedValue(depositData);

      await expect(stripeService.releaseDeposit('hold-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('DEPOSIT CAPTURE', () => {
    it('should capture deposit amount', async () => {
      const depositData = {
        id: 'hold-1',
        bookingId: 'booking-1',
        paymentIntentId: 'pi_deposit_123',
        amount: 200,
        currency: 'USD',
        status: DepositStatus.AUTHORIZED,
      };

      prisma.depositHold.findUnique.mockResolvedValue(depositData);
      stripeClient.paymentIntents.capture.mockResolvedValue({});
      prisma.depositHold.update.mockResolvedValue({ id: 'hold-1' });

      await stripeService.captureDeposit('hold-1');

      expect(stripeClient.paymentIntents.capture).toHaveBeenCalledWith('pi_deposit_123', {
        amount_to_capture: undefined,
      });
      expect(prisma.depositHold.update).toHaveBeenCalledWith({
        where: { id: 'hold-1' },
        data: expect.objectContaining({
          status: DepositStatus.CAPTURED,
          capturedAt: expect.any(Date),
        }),
      });
    });

    it('should capture partial deposit amount', async () => {
      const depositData = {
        id: 'hold-1',
        bookingId: 'booking-1',
        paymentIntentId: 'pi_deposit_123',
        amount: 200,
        currency: 'USD',
        status: DepositStatus.AUTHORIZED,
      };

      prisma.depositHold.findUnique.mockResolvedValue(depositData);
      stripeClient.paymentIntents.capture.mockResolvedValue({});
      prisma.depositHold.update.mockResolvedValue({ id: 'hold-1' });

      await stripeService.captureDeposit('hold-1', 150);

      expect(stripeClient.paymentIntents.capture).toHaveBeenCalledWith('pi_deposit_123', {
        amount_to_capture: 15000,
      });
    });
  });

  describe('REFUND PROCESSING', () => {
    it('should create refund with payment intent ID', async () => {
      stripeClient.refunds.create.mockResolvedValue({
        id: 're_123',
        amount: 80000,
        currency: 'usd',
        status: 'succeeded',
      });

      const result = await stripeService.createRefund('pi_123', 800, 'USD', 'requested_by_customer');

      expect(result).toBe('re_123');
      expect(stripeClient.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_123',
          amount: 80000,
          reason: 'requested_by_customer',
        }),
        expect.objectContaining({
          idempotencyKey: expect.stringContaining('refund_pi_123_80000'),
        }),
      );
    });

    it('should create refund with params object', async () => {
      stripeClient.refunds.create.mockResolvedValue({
        id: 're_123',
        amount: 80000,
        currency: 'usd',
        status: 'succeeded',
      });

      const result = await stripeService.createRefund({
        paymentIntentId: 'pi_123',
        amount: 800,
        currency: 'USD',
        reason: 'duplicate',
        idempotencyKey: 'custom_key',
      });

      expect(result).toBe('re_123');
      expect(stripeClient.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_123',
          amount: 80000,
          reason: 'duplicate',
        }),
        expect.objectContaining({
          idempotencyKey: 'custom_key',
        }),
      );
    });

    it('should reject refund with zero or negative amount', async () => {
      await expect(stripeService.createRefund('pi_123', 0, 'USD')).rejects.toThrow(BadRequestException);
    });

    it('should handle Stripe card decline errors', async () => {
      const stripeError = new Stripe.errors.StripeCardError('Your card was declined');
      stripeError.decline_code = 'generic_decline';
      stripeClient.refunds.create.mockRejectedValue(stripeError);

      await expect(stripeService.createRefund('pi_123', 800, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle Stripe rate limit errors', async () => {
      const stripeError = new Stripe.errors.StripeRateLimitError('Rate limit exceeded');
      stripeClient.refunds.create.mockRejectedValue(stripeError);

      await expect(stripeService.createRefund('pi_123', 800, 'USD')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle Stripe connection errors', async () => {
      const stripeError = new Stripe.errors.StripeConnectionError('Connection error');
      stripeClient.refunds.create.mockRejectedValue(stripeError);

      await expect(stripeService.createRefund('pi_123', 800, 'USD')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('PAYOUT PROCESSING', () => {
    it('should create payout with account ID', async () => {
      stripeClient.payouts.create.mockResolvedValue({
        id: 'po_123',
        amount: 80000,
        currency: 'usd',
        status: 'in_transit',
      });

      const result = await stripeService.createPayout('acct_123', 800, 'USD');

      expect(result).toBe('po_123');
      expect(stripeClient.payouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 80000,
          currency: 'usd',
        }),
        expect.objectContaining({
          stripeAccount: 'acct_123',
        }),
      );
    });

    it('should create payout with params object', async () => {
      stripeClient.payouts.create.mockResolvedValue({
        id: 'po_123',
        amount: 80000,
        currency: 'usd',
        status: 'in_transit',
      });

      const result = await stripeService.createPayout({
        accountId: 'acct_123',
        amount: 800,
        currency: 'USD',
        idempotencyKey: 'payout_key',
      });

      expect(result).toBe('po_123');
      expect(stripeClient.payouts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 80000,
          currency: 'usd',
        }),
        expect.objectContaining({
          stripeAccount: 'acct_123',
          idempotencyKey: 'payout_key',
        }),
      );
    });

    it('should reject payout with zero or negative amount', async () => {
      await expect(stripeService.createPayout('acct_123', 0, 'USD')).rejects.toThrow(BadRequestException);
    });
  });

  describe('CONNECT ACCOUNT MANAGEMENT', () => {
    it('should create new connect account if user does not have one', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeConnectId: null });
      stripeClient.accounts.create.mockResolvedValue({ id: 'acct_123' });
      prisma.user.update.mockResolvedValue({ id: 'user-1', stripeConnectId: 'acct_123' });

      const result = await stripeService.createConnectAccount('user-1', 'user@example.com');

      expect(result).toBe('acct_123');
      expect(stripeClient.accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          email: 'user@example.com',
          capabilities: expect.objectContaining({
            card_payments: { requested: true },
            transfers: { requested: true },
          }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stripeConnectId: 'acct_123' },
      });
    });

    it('should return existing account if user already has one', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeConnectId: 'acct_existing' });

      const result = await stripeService.createConnectAccount('user-1', 'user@example.com');

      expect(result).toBe('acct_existing');
      expect(stripeClient.accounts.create).not.toHaveBeenCalled();
    });

    it('should create account link for onboarding', async () => {
      stripeClient.accountLinks.create.mockResolvedValue({
        id: 'link_123',
        url: 'https://connect.stripe.com/setup/link/123',
      });

      const result = await stripeService.createAccountLink(
        'acct_123',
        'https://example.com/return',
        'https://example.com/refresh',
      );

      expect(result).toBe('https://connect.stripe.com/setup/link/123');
      expect(stripeClient.accountLinks.create).toHaveBeenCalledWith({
        account: 'acct_123',
        return_url: 'https://example.com/return',
        refresh_url: 'https://example.com/refresh',
        type: 'account_onboarding',
      });
    });

    it('should get account status', async () => {
      stripeClient.accounts.retrieve.mockResolvedValue({
        id: 'acct_123',
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: false,
      });

      const result = await stripeService.getAccountStatus('acct_123');

      expect(result).toEqual({
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: false,
      });
    });
  });

  describe('CUSTOMER MANAGEMENT', () => {
    it('should create new customer', async () => {
      stripeClient.customers.create.mockResolvedValue({
        id: 'cus_123',
        email: 'user@example.com',
        name: 'John Doe',
      });
      prisma.user.update.mockResolvedValue({ id: 'user-1', stripeCustomerId: 'cus_123' });

      const result = await stripeService.createCustomer('user-1', 'user@example.com', 'John Doe');

      expect(result).toBe('cus_123');
      expect(stripeClient.customers.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: 'John Doe',
        metadata: { userId: 'user-1' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stripeCustomerId: 'cus_123' },
      });
    });

    it('should attach payment method to customer', async () => {
      stripeClient.paymentMethods.attach.mockResolvedValue({ id: 'pm_123' });

      await stripeService.attachPaymentMethod('cus_123', 'pm_123');

      expect(stripeClient.paymentMethods.attach).toHaveBeenCalledWith('pm_123', {
        customer: 'cus_123',
      });
    });

    it('should set default payment method for customer', async () => {
      stripeClient.customers.update.mockResolvedValue({ id: 'cus_123' });

      await stripeService.setDefaultPaymentMethod('cus_123', 'pm_123');

      expect(stripeClient.customers.update).toHaveBeenCalledWith('cus_123', {
        invoice_settings: {
          default_payment_method: 'pm_123',
        },
      });
    });
  });

  describe('PAYMENT INTENT STATUS', () => {
    it('should get payment intent status', async () => {
      stripeClient.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        last_payment_error: null,
      });

      const result = await stripeService.getPaymentIntentStatus('pi_123');

      expect(result).toEqual({
        status: 'succeeded',
        failureReason: null,
      });
    });

    it('should get payment intent status with failure reason', async () => {
      stripeClient.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_123',
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Your card was declined',
        },
      });

      const result = await stripeService.getPaymentIntentStatus('pi_123');

      expect(result).toEqual({
        status: 'requires_payment_method',
        failureReason: 'Your card was declined',
      });
    });

    it('should capture payment intent', async () => {
      stripeClient.paymentIntents.capture.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
      });

      await stripeService.capturePaymentIntent('pi_123');

      expect(stripeClient.paymentIntents.capture).toHaveBeenCalledWith(
        'pi_123',
        {},
        expect.objectContaining({
          idempotencyKey: expect.stringContaining('capture_pi_123'),
        }),
      );
    });
  });

  describe('ERROR HANDLING WITH TEST CARDS', () => {
    it('should handle generic decline (card: 4000000000000002)', async () => {
      const stripeError = new Stripe.errors.StripeCardError('Your card was declined');
      stripeError.code = 'card_declined';
      stripeError.decline_code = 'generic_decline';
      stripeClient.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle insufficient funds (card: 4000000000009995)', async () => {
      const stripeError = new Stripe.errors.StripeCardError('Your card has insufficient funds');
      stripeError.code = 'card_declined';
      stripeError.decline_code = 'insufficient_funds';
      stripeClient.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle lost card (card: 4000000000009979)', async () => {
      const stripeError = new Stripe.errors.StripeCardError('Your card was reported as lost');
      stripeError.code = 'card_declined';
      stripeError.decline_code = 'lost_card';
      stripeClient.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle stolen card (card: 4000000000009987)', async () => {
      const stripeError = new Stripe.errors.StripeCardError('Your card was reported as stolen');
      stripeError.code = 'card_declined';
      stripeError.decline_code = 'stolen_card';
      stripeClient.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle expired card (card: 4000000000000069)', async () => {
      const stripeError = new Stripe.errors.StripeCardError('Your card has expired');
      stripeError.code = 'card_declined';
      stripeError.decline_code = 'expired_card';
      stripeClient.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle processing error (card: 4000000000000119)', async () => {
      const stripeError = new Stripe.errors.StripeAPIError('An error occurred while processing your card');
      stripeClient.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(stripeService.createPaymentIntent('booking-1', 1000, 'USD')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('CURRENCY SUPPORT', () => {
    it('should support multiple currencies based on config', () => {
      const config = stripeService.config;

      expect(config.supportedCurrencies).toContain('USD');
      expect(config.supportedCurrencies).toContain('EUR');
      expect(config.supportedCurrencies).toContain('GBP');
      expect(config.supportedCurrencies).toContain('JPY');
      expect(config.supportedCurrencies).toContain('INR');
    });

    it('should support multiple countries based on config', () => {
      const config = stripeService.config;

      expect(config.supportedCountries).toContain('US');
      expect(config.supportedCountries).toContain('GB');
      expect(config.supportedCountries).toContain('CA');
      expect(config.supportedCountries).toContain('AU');
      expect(config.supportedCountries).toContain('IN');
    });
  });
});
