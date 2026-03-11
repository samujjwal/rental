import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentDataService } from './payment-data.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('PaymentDataService', () => {
  let service: PaymentDataService;
  let prisma: any;

  const userId = 'user-1';
  const bookingId = 'booking-1';

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      depositHold: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentDataService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PaymentDataService>(PaymentDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserStripeConnectId', () => {
    it('should return stripeConnectId', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeConnectId: 'acct_123' });

      const result = await service.getUserStripeConnectId(userId);

      expect(result).toBe('acct_123');
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserStripeConnectId(userId);

      expect(result).toBeNull();
    });

    it('should return null if stripeConnectId not set', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeConnectId: null });

      const result = await service.getUserStripeConnectId(userId);

      expect(result).toBeNull();
    });
  });

  describe('getUserStripeCustomerId', () => {
    it('should return stripeCustomerId', async () => {
      prisma.user.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_123' });

      const result = await service.getUserStripeCustomerId(userId);

      expect(result).toBe('cus_123');
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserStripeCustomerId(userId);

      expect(result).toBeNull();
    });
  });

  describe('getBookingForPayment', () => {
    it('should return booking with renter', async () => {
      const mockBooking = {
        id: bookingId,
        renter: { id: userId, name: 'John' },
      };
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const result = await service.getBookingForPayment(bookingId);

      expect(result).toEqual(mockBooking);
      expect(prisma.booking.findUnique).toHaveBeenCalledWith({
        where: { id: bookingId },
        include: { renter: true },
      });
    });

    it('should throw NotFoundException if booking not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getBookingForPayment('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getBookingMinimal', () => {
    it('should return booking without relations', async () => {
      prisma.booking.findUnique.mockResolvedValue({ id: bookingId });

      const result = await service.getBookingMinimal(bookingId);

      expect(result).toEqual({ id: bookingId });
    });

    it('should throw NotFoundException if booking not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getBookingMinimal('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBookingPaymentIntent', () => {
    it('should update booking paymentIntentId', async () => {
      prisma.booking.update.mockResolvedValue({
        id: bookingId,
        paymentIntentId: 'pi_123',
      });

      const result = await service.updateBookingPaymentIntent(
        bookingId,
        'pi_123',
      );

      expect(result.paymentIntentId).toBe('pi_123');
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: bookingId },
        data: { paymentIntentId: 'pi_123' },
      });
    });
  });

  describe('createPaymentRecord', () => {
    it('should create a payment record', async () => {
      const paymentData = {
        bookingId,
        amount: 100,
        currency: 'USD',
        status: 'COMPLETED',
        paymentIntentId: 'pi_123',
        stripePaymentIntentId: 'pi_stripe_123',
      };
      prisma.payment.create.mockResolvedValue({ id: 'pay-1', ...paymentData });

      const result = await service.createPaymentRecord(paymentData);

      expect(result.id).toBe('pay-1');
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId,
          amount: 100,
          currency: 'USD',
        }),
      });
    });
  });

  describe('getDepositHold', () => {
    it('should return deposit hold', async () => {
      const mockDeposit = { id: 'dep-1', amount: 500 };
      prisma.depositHold.findUnique.mockResolvedValue(mockDeposit);

      const result = await service.getDepositHold('dep-1');

      expect(result).toEqual(mockDeposit);
    });

    it('should throw NotFoundException if deposit not found', async () => {
      prisma.depositHold.findUnique.mockResolvedValue(null);

      await expect(service.getDepositHold('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDepositWithBooking', () => {
    it('should return deposit and booking', async () => {
      const deposit = { id: 'dep-1', bookingId, amount: 500 };
      const booking = { id: bookingId, status: 'COMPLETED' };
      prisma.depositHold.findUnique.mockResolvedValue(deposit);
      prisma.booking.findUnique.mockResolvedValue(booking);

      const result = await service.getDepositWithBooking('dep-1');

      expect(result.deposit).toEqual(deposit);
      expect(result.booking).toEqual(booking);
    });

    it('should throw NotFoundException if deposit not found', async () => {
      prisma.depositHold.findUnique.mockResolvedValue(null);

      await expect(service.getDepositWithBooking('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if deposit has no booking', async () => {
      prisma.depositHold.findUnique.mockResolvedValue({
        id: 'dep-1',
        bookingId: null,
      });

      await expect(service.getDepositWithBooking('dep-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if booking not found for deposit', async () => {
      prisma.depositHold.findUnique.mockResolvedValue({
        id: 'dep-1',
        bookingId,
      });
      prisma.booking.findUnique.mockResolvedValue(null);

      await expect(service.getDepositWithBooking('dep-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLatestPaymentForBooking', () => {
    it('should return latest payment', async () => {
      const mockPayment = {
        id: 'pay-1',
        bookingId,
        amount: 100,
        booking: { renterId: userId },
      };
      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      const result = await service.getLatestPaymentForBooking(bookingId);

      expect(result).toEqual(mockPayment);
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
        include: { booking: { select: { renterId: true } } },
      });
    });

    it('should return null when no payments exist', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      const result = await service.getLatestPaymentForBooking(bookingId);

      expect(result).toBeNull();
    });
  });
});
