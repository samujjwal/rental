import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { StripeService } from '../services/stripe.service';
import { PayoutsService } from '../services/payouts.service';
import { LedgerService } from '../services/ledger.service';
import { PaymentDataService } from '../services/payment-data.service';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('PaymentsController', () => {
  let module: TestingModule;
  let controller: PaymentsController;
  let stripe: jest.Mocked<StripeService>;
  let ledger: jest.Mocked<LedgerService>;
  let payouts: jest.Mocked<PayoutsService>;
  let paymentData: jest.Mocked<PaymentDataService>;
  let prisma: any;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: StripeService,
          useValue: {
            createConnectAccount: jest.fn(),
            createAccountLink: jest.fn(),
            getAccountStatus: jest.fn(),
            createPaymentIntent: jest.fn(),
            holdDeposit: jest.fn(),
            releaseDeposit: jest.fn(),
            createCustomer: jest.fn(),
            getPaymentMethods: jest.fn(),
            attachPaymentMethod: jest.fn(),
            createRefund: jest.fn(),
          },
        },
        {
          provide: LedgerService,
          useValue: {
            recordDepositHold: jest.fn(),
            recordDepositRelease: jest.fn(),
            getOwnerEarningsSummary: jest.fn(),
            getBookingLedger: jest.fn(),
            getUserBalance: jest.fn(),
            getUserTransactions: jest.fn(),
            recordRefund: jest.fn(),
          },
        },
        {
          provide: PayoutsService,
          useValue: {
            createPayout: jest.fn(),
            getOwnerPayouts: jest.fn(),
            getPendingEarnings: jest.fn(),
          },
        },
        {
          provide: PaymentDataService,
          useValue: {
            getUserStripeConnectId: jest.fn(),
            getBookingForPayment: jest.fn(),
            updateBookingPaymentIntent: jest.fn(),
            createPaymentRecord: jest.fn(),
            getBookingMinimal: jest.fn(),
            getDepositWithBooking: jest.fn(),
            getUserStripeCustomerId: jest.fn(),
            getLatestPaymentForBooking: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            listing: { findUnique: jest.fn() },
            user: { findUnique: jest.fn() },
            booking: { findUnique: jest.fn() },
            userPreferences: { findUnique: jest.fn() },
            $transaction: jest.fn().mockImplementation((cb: any) =>
              cb({
                listing: { findUnique: jest.fn() },
                user: { findUnique: jest.fn() },
                booking: { findUnique: jest.fn(), update: jest.fn() },
                payment: { create: jest.fn().mockResolvedValue({ id: 'pay-1' }) },
                ledgerEntry: { create: jest.fn().mockResolvedValue({}) },
              }),
            ),
          },
        },
      ],
    }).compile();

    controller = module.get(PaymentsController);
    stripe = module.get(StripeService) as jest.Mocked<StripeService>;
    ledger = module.get(LedgerService) as jest.Mocked<LedgerService>;
    payouts = module.get(PayoutsService) as jest.Mocked<PayoutsService>;
    paymentData = module.get(PaymentDataService) as jest.Mocked<PaymentDataService>;
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── startOnboarding ──
  describe('startOnboarding', () => {
    it('creates connect account and returns onboarding URL', async () => {
      stripe.createConnectAccount.mockResolvedValue('acct_123');
      stripe.createAccountLink.mockResolvedValue('https://stripe.com/onboard');
      const result = await controller.startOnboarding('u1', 'user@test.com', {
        returnUrl: 'https://app.com/return',
        refreshUrl: 'https://app.com/refresh',
      } as any);
      expect(result).toEqual({ url: 'https://stripe.com/onboard', accountId: 'acct_123' });
    });
  });

  // ── getAccountStatus ──
  describe('getAccountStatus', () => {
    it('returns connected:false when no stripe id', async () => {
      paymentData.getUserStripeConnectId.mockResolvedValue(null as any);
      const result = await controller.getAccountStatus('u1');
      expect(result).toEqual({ connected: false });
    });

    it('returns status when connected', async () => {
      paymentData.getUserStripeConnectId.mockResolvedValue('acct_123');
      stripe.getAccountStatus.mockResolvedValue({ chargesEnabled: true } as any);
      const result = await controller.getAccountStatus('u1');
      expect(result.connected).toBe(true);
      expect((result as any).accountId).toBe('acct_123');
      expect((result as any).chargesEnabled).toBe(true);
    });
  });

  // ── createPaymentIntent ──
  describe('createPaymentIntent', () => {
    it('creates intent for valid booking', async () => {
      paymentData.getBookingForPayment.mockResolvedValue({
        renterId: 'u1',
        status: 'PENDING_PAYMENT',
        totalPrice: 1000,
        currency: 'NPR',
        renter: { stripeCustomerId: 'cus_123' },
      } as any);
      stripe.createPaymentIntent.mockResolvedValue({ paymentIntentId: 'pi_123', clientSecret: 'cs' } as any);
      const result = await controller.createPaymentIntent('b1', 'u1');
      expect(result.paymentIntentId).toBe('pi_123');
    });

    it('throws ForbiddenException for non-renter', async () => {
      paymentData.getBookingForPayment.mockResolvedValue({
        renterId: 'other-user',
        status: 'PENDING_PAYMENT',
      } as any);
      await expect(controller.createPaymentIntent('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for non-pending booking', async () => {
      paymentData.getBookingForPayment.mockResolvedValue({
        renterId: 'u1',
        status: 'APPROVED',
      } as any);
      await expect(controller.createPaymentIntent('b1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── holdDeposit ──
  describe('holdDeposit', () => {
    it('holds deposit and records in ledger', async () => {
      paymentData.getBookingMinimal.mockResolvedValue({
        securityDeposit: 500,
        currency: 'NPR',
        renterId: 'u1',
      } as any);
      stripe.holdDeposit.mockResolvedValue('pi_dep');
      const result = await controller.holdDeposit('b1', 'u1');
      expect(result).toEqual({ paymentIntentId: 'pi_dep' });
      expect(ledger.recordDepositHold).toHaveBeenCalled();
    });

    it('throws BadRequestException when no deposit required', async () => {
      paymentData.getBookingMinimal.mockResolvedValue({ securityDeposit: 0, renterId: 'u1' } as any);
      await expect(controller.holdDeposit('b1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is not the renter', async () => {
      paymentData.getBookingMinimal.mockResolvedValue({
        securityDeposit: 500,
        currency: 'NPR',
        renterId: 'other-user',
      } as any);
      await expect(controller.holdDeposit('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── releaseDeposit ──
  describe('releaseDeposit', () => {
    it('releases deposit and records in ledger', async () => {
      paymentData.getDepositWithBooking.mockResolvedValue({
        deposit: { bookingId: 'b1', amount: 500, currency: 'NPR' },
        booking: { renterId: 'u1', ownerId: 'owner1' },
      } as any);
      const result = await controller.releaseDeposit('dep1', { id: 'owner1', role: 'OWNER' });
      expect(stripe.releaseDeposit).toHaveBeenCalledWith('dep1');
      expect(result).toEqual({ success: true });
    });

    it('allows admin to release deposit', async () => {
      paymentData.getDepositWithBooking.mockResolvedValue({
        deposit: { bookingId: 'b1', amount: 500, currency: 'NPR' },
        booking: { renterId: 'u1', ownerId: 'owner1' },
      } as any);
      const result = await controller.releaseDeposit('dep1', { id: 'admin1', role: 'ADMIN' });
      expect(result).toEqual({ success: true });
    });

    it('throws ForbiddenException when user is not owner or admin', async () => {
      paymentData.getDepositWithBooking.mockResolvedValue({
        deposit: { bookingId: 'b1', amount: 500, currency: 'NPR' },
        booking: { renterId: 'u1', ownerId: 'owner1' },
      } as any);
      await expect(
        controller.releaseDeposit('dep1', { id: 'random-user', role: 'USER' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── createCustomer ──
  describe('createCustomer', () => {
    it('returns customerId', async () => {
      stripe.createCustomer.mockResolvedValue('cus_123');
      const result = await controller.createCustomer('u1', 'user@test.com', 'Sam', 'D');
      expect(stripe.createCustomer).toHaveBeenCalledWith('u1', 'user@test.com', 'Sam D');
      expect(result).toEqual({ customerId: 'cus_123' });
    });
  });

  // ── getPaymentMethods ──
  describe('getPaymentMethods', () => {
    it('returns empty data when no stripe customer', async () => {
      paymentData.getUserStripeCustomerId.mockResolvedValue(null as any);
      const result = await controller.getPaymentMethods('u1');
      expect(result).toEqual({ data: [] as any[] });
    });

    it('delegates to stripe when customer exists', async () => {
      paymentData.getUserStripeCustomerId.mockResolvedValue('cus_123');
      stripe.getPaymentMethods.mockResolvedValue({ data: [{ id: 'pm_1' }] } as any);
      const result = await controller.getPaymentMethods('u1');
      expect(result).toEqual({ data: [{ id: 'pm_1' }] });
    });
  });

  // ── attachPaymentMethod ──
  describe('attachPaymentMethod', () => {
    it('attaches payment method', async () => {
      paymentData.getUserStripeCustomerId.mockResolvedValue('cus_123');
      const result = await controller.attachPaymentMethod('u1', { paymentMethodId: 'pm_1' } as any);
      expect(stripe.attachPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_1');
      expect(result).toEqual({ success: true });
    });

    it('throws BadRequestException when no customer', async () => {
      paymentData.getUserStripeCustomerId.mockResolvedValue(null as any);
      await expect(
        controller.attachPaymentMethod('u1', { paymentMethodId: 'pm_1' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── requestPayout ──
  describe('requestPayout', () => {
    it('delegates to payouts service', async () => {
      payouts.createPayout.mockResolvedValue({ id: 'po1' } as any);
      await controller.requestPayout('u1', { amount: 1000 } as any);
      expect(payouts.createPayout).toHaveBeenCalledWith('u1', 1000);
    });
  });

  // ── getPayouts ──
  describe('getPayouts', () => {
    it('delegates to payouts service', async () => {
      payouts.getOwnerPayouts.mockResolvedValue([] as any);
      await controller.getPayouts('u1');
      expect(payouts.getOwnerPayouts).toHaveBeenCalledWith('u1');
    });
  });

  // ── getEarnings ──
  describe('getEarnings', () => {
    it('delegates to getPendingEarnings', async () => {
      payouts.getPendingEarnings.mockResolvedValue({ total: 5000 } as any);
      await controller.getEarnings('u1');
      expect(payouts.getPendingEarnings).toHaveBeenCalledWith('u1');
    });
  });

  // ── getEarningsSummary ──
  describe('getEarningsSummary', () => {
    it('delegates to ledger service', async () => {
      ledger.getOwnerEarningsSummary.mockResolvedValue({} as any);
      await controller.getEarningsSummary('u1');
      expect(ledger.getOwnerEarningsSummary).toHaveBeenCalledWith('u1');
    });
  });

  // ── getBookingLedger ──
  describe('getBookingLedger', () => {
    it('delegates booking id', async () => {
      prisma.booking.findUnique.mockResolvedValue({ renterId: 'u1', listing: { ownerId: 'owner1' } });
      ledger.getBookingLedger.mockResolvedValue([] as any);
      await controller.getBookingLedger('u1', 'b1');
      expect(ledger.getBookingLedger).toHaveBeenCalledWith('b1');
    });
  });

  // ── getBalance ──
  describe('getBalance', () => {
    it('returns balance with currency', async () => {
      prisma.userPreferences.findUnique.mockResolvedValue({ currency: 'NPR' });
      ledger.getUserBalance.mockResolvedValue(2500);
      const result = await controller.getBalance('u1');
      expect(result).toEqual({ balance: 2500, currency: 'NPR' });
    });
  });

  // ── getTransactions ──
  describe('getTransactions', () => {
    it('defaults to page 1 and limit 20', async () => {
      ledger.getUserTransactions.mockResolvedValue({ data: [] as any[], total: 0 } as any);
      await controller.getTransactions('u1', undefined, undefined, undefined, undefined, undefined, undefined);
      expect(ledger.getUserTransactions).toHaveBeenCalledWith('u1', expect.objectContaining({ page: 1, limit: 20 }));
    });

    it('parses date filters', async () => {
      ledger.getUserTransactions.mockResolvedValue({ data: [] as any[] } as any);
      await controller.getTransactions('u1', undefined, undefined, undefined, undefined, '2025-01-01', '2025-12-31');
      expect(ledger.getUserTransactions).toHaveBeenCalledWith('u1', expect.objectContaining({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      }));
    });
  });

  // ── requestRefund ──
  describe('requestRefund', () => {
    it('creates refund and records in ledger', async () => {
      ledger.getBookingLedger.mockResolvedValue([{}] as any);
      paymentData.getLatestPaymentForBooking.mockResolvedValue({
        stripePaymentIntentId: 'pi_123',
        amount: 1000,
        currency: 'NPR',
        booking: { renterId: 'u1' },
      } as any);
      stripe.createRefund.mockResolvedValue('re_123');

      const result = await controller.requestRefund('b1', { id: 'u1', role: 'USER' } as any, { reason: 'defective' } as any);
      expect(result.refundId).toBe('re_123');
      expect(ledger.recordRefund).toHaveBeenCalled();
    });

    it('throws NotFoundException when no booking ledger', async () => {
      ledger.getBookingLedger.mockResolvedValue(null as any);
      await expect(
        controller.requestRefund('b1', { id: 'u1', role: 'USER' } as any, {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when no payment found', async () => {
      ledger.getBookingLedger.mockResolvedValue([{}] as any);
      paymentData.getLatestPaymentForBooking.mockResolvedValue(null as any);
      await expect(
        controller.requestRefund('b1', { id: 'u1', role: 'USER' } as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is not renter or admin', async () => {
      ledger.getBookingLedger.mockResolvedValue([{}] as any);
      paymentData.getLatestPaymentForBooking.mockResolvedValue({
        stripePaymentIntentId: 'pi_123',
        amount: 1000,
        currency: 'NPR',
        booking: { renterId: 'other-user' },
      } as any);
      await expect(
        controller.requestRefund('b1', { id: 'u1', role: 'USER' } as any, { reason: 'defective' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to request refund for any booking', async () => {
      ledger.getBookingLedger.mockResolvedValue([{}] as any);
      paymentData.getLatestPaymentForBooking.mockResolvedValue({
        stripePaymentIntentId: 'pi_123',
        amount: 1000,
        currency: 'NPR',
        booking: { renterId: 'other-user' },
      } as any);
      stripe.createRefund.mockResolvedValue('re_123');
      const result = await controller.requestRefund(
        'b1',
        { id: 'admin1', role: 'ADMIN' } as any,
        { reason: 'defective' } as any,
      );
      expect(result.refundId).toBe('re_123');
    });
  });
});
