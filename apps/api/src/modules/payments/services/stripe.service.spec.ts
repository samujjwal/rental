import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { DepositStatus, BookingStatus } from '@rental-portal/database';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    accounts: { create: jest.fn(), retrieve: jest.fn() },
    accountLinks: { create: jest.fn() },
    paymentIntents: { create: jest.fn(), capture: jest.fn(), cancel: jest.fn() },
    refunds: { create: jest.fn() },
    payouts: { create: jest.fn() },
    customers: { create: jest.fn(), update: jest.fn() },
    paymentMethods: { attach: jest.fn(), list: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
  }));
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

      const stripeInstance = (service as any).stripe;
      stripeInstance.paymentIntents.create.mockResolvedValue({ id: 'pi_deposit' });

      mockPrismaService.depositHold.create.mockResolvedValue({ id: 'dh_1' });

      const res = await service.holdDeposit('b1', 500, 'USD');

      expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          customer: 'cus_123',
          capture_method: 'manual',
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
});
