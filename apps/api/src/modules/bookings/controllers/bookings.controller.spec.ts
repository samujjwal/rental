import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsDevController } from './bookings-dev.controller';
import { BookingsService } from '../services/bookings.service';
import { BookingStateMachineService } from '../services/booking-state-machine.service';
import { BookingCalculationService } from '../services/booking-calculation.service';
import { InvoiceService } from '../services/invoice.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { ContextResolverService } from '../../policy-engine/services/context-resolver.service';

describe('BookingsController', () => {
  let module: TestingModule;
  let controller: BookingsController;
  let devController: BookingsDevController;
  let bookingsService: jest.Mocked<BookingsService>;
  let stateMachine: jest.Mocked<BookingStateMachineService>;
  let calculation: jest.Mocked<BookingCalculationService>;
  let invoiceService: jest.Mocked<InvoiceService>;
  let prisma: any;

  const mockBooking = {
    id: 'b1',
    renterId: 'u1',
    listing: { ownerId: 'u2' },
    status: 'PENDING',
    totalPrice: 1000,
    currency: 'NPR',
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [BookingsController, BookingsDevController],
      providers: [
        {
          provide: BookingsService,
          useValue: {
            create: jest.fn(),
            getRenterBookings: jest.fn(),
            getOwnerBookings: jest.fn(),
            findById: jest.fn(),
            getBookingDisputes: jest.fn(),
            approveBooking: jest.fn(),
            rejectBooking: jest.fn(),
            cancelBooking: jest.fn(),
            startRental: jest.fn(),
            requestReturn: jest.fn(),
            approveReturn: jest.fn(),
            rejectReturn: jest.fn(),
            initiateDispute: jest.fn(),
            getBookingStats: jest.fn(),
            getBlockedDates: jest.fn(),
          },
        },
        {
          provide: BookingStateMachineService,
          useValue: {
            getAvailableTransitions: jest.fn(),
            transition: jest.fn(),
          },
        },
        {
          provide: BookingCalculationService,
          useValue: {
            calculatePrice: jest.fn(),
          },
        },
        {
          provide: InvoiceService,
          useValue: {
            getInvoiceData: jest.fn(),
            generateInvoiceHtml: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            listing: { findUnique: jest.fn() },
            user: { findUnique: jest.fn() },
            booking: { findUnique: jest.fn(), updateMany: jest.fn() },
          },
        },
        {
          provide: PolicyEngineService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({ allowed: true, actions: [] }),
            calculateTax: jest.fn().mockResolvedValue({ totalTax: 0, lines: [] }),
          },
        },
        {
          provide: ContextResolverService,
          useValue: {
            resolve: jest.fn().mockReturnValue({ locale: 'en', currency: 'NPR', country: 'NP' }),
          },
        },
      ],
    }).compile();

    controller = module.get(BookingsController);
    devController = module.get(BookingsDevController);
    bookingsService = module.get(BookingsService) as jest.Mocked<BookingsService>;
    stateMachine = module.get(BookingStateMachineService) as jest.Mocked<BookingStateMachineService>;
    calculation = module.get(BookingCalculationService) as jest.Mocked<BookingCalculationService>;
    invoiceService = module.get(InvoiceService) as jest.Mocked<InvoiceService>;
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    if (module) await module.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ──
  describe('create', () => {
    it('delegates to bookingsService.create', async () => {
      bookingsService.create.mockResolvedValue(mockBooking as any);
      const dto = { listingId: 'l1', startDate: '2025-01-01', endDate: '2025-01-05' } as any;
      const result = await controller.create('u1', dto);
      expect(bookingsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(mockBooking);
    });
  });

  // ── getMyBookings ──
  describe('getMyBookings', () => {
    it('calls getRenterBookings with userId and optional status', async () => {
      bookingsService.getRenterBookings.mockResolvedValue([mockBooking] as any);
      const result = await controller.getMyBookings('u1', 'PENDING' as any);
      expect(bookingsService.getRenterBookings).toHaveBeenCalledWith('u1', 'PENDING', 1, 20);
      expect(result).toHaveLength(1);
    });
  });

  // ── getHostBookings ──
  describe('getHostBookings', () => {
    it('calls getOwnerBookings with userId', async () => {
      bookingsService.getOwnerBookings.mockResolvedValue([] as any);
      await controller.getHostBookings('u1', undefined);
      expect(bookingsService.getOwnerBookings).toHaveBeenCalledWith('u1', undefined, 1, 20);
    });
  });

  // ── findById ──
  describe('findById', () => {
    it('passes userId for authorization check', async () => {
      bookingsService.findById.mockResolvedValue(mockBooking as any);
      await controller.findById('b1', 'u1');
      expect(bookingsService.findById).toHaveBeenCalledWith('b1', true, 'u1');
    });
  });

  // ── getBookingDisputes ──
  describe('getBookingDisputes', () => {
    it('delegates to service', async () => {
      bookingsService.getBookingDisputes.mockResolvedValue([{ id: 'd1' }] as any);
      const result = await controller.getBookingDisputes('b1', 'u1');
      expect(bookingsService.getBookingDisputes).toHaveBeenCalledWith('b1', 'u1');
      expect(result).toHaveLength(1);
    });
  });

  // ── approve / reject / cancel ──
  describe('approve', () => {
    it('delegates to approveBooking', async () => {
      bookingsService.approveBooking.mockResolvedValue(mockBooking as any);
      await controller.approve('b1', 'u2');
      expect(bookingsService.approveBooking).toHaveBeenCalledWith('b1', 'u2');
    });
  });

  describe('reject', () => {
    it('passes reason from dto', async () => {
      bookingsService.rejectBooking.mockResolvedValue(mockBooking as any);
      await controller.reject('b1', 'u2', { reason: 'Not available' } as any);
      expect(bookingsService.rejectBooking).toHaveBeenCalledWith('b1', 'u2', 'Not available');
    });
  });

  describe('cancel', () => {
    it('passes reason from dto', async () => {
      bookingsService.cancelBooking.mockResolvedValue(mockBooking as any);
      await controller.cancel('b1', 'u1', { reason: 'Changed plans' } as any);
      expect(bookingsService.cancelBooking).toHaveBeenCalledWith('b1', 'u1', 'Changed plans');
    });
  });

  describe('bypassConfirm', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalStripeTestBypass = process.env.STRIPE_TEST_BYPASS;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.STRIPE_TEST_BYPASS = 'true';
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        renterId: 'u1',
        listing: { ownerId: 'u2' },
      });
      stateMachine.transition.mockResolvedValue({ success: true } as any);
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.STRIPE_TEST_BYPASS = originalStripeTestBypass;
    });

    it('allows the booking renter to confirm through the bypass endpoint', async () => {
      await devController.bypassConfirm('b1', 'u1', 'USER');

      expect(stateMachine.transition).toHaveBeenCalledWith('b1', 'COMPLETE_PAYMENT', 'u1', 'RENTER');
    });

    it('rejects non-renters', async () => {
      await expect(devController.bypassConfirm('b1', 'u3', 'USER')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('devReset', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalStripeTestBypass = process.env.STRIPE_TEST_BYPASS;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.STRIPE_TEST_BYPASS = 'true';
      prisma.booking.updateMany.mockResolvedValue({ count: 2 });
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.STRIPE_TEST_BYPASS = originalStripeTestBypass;
    });

    it('requires an admin role', async () => {
      await expect(devController.devReset('USER')).rejects.toThrow(ForbiddenException);
    });

    it('allows admins to reset non-final bookings', async () => {
      await expect(devController.devReset('ADMIN')).resolves.toEqual({ cancelled: 2 });
    });
  });

  // ── startRental ──
  describe('startRental', () => {
    it('delegates to service', async () => {
      bookingsService.startRental.mockResolvedValue(mockBooking as any);
      await controller.startRental('b1', 'u2');
      expect(bookingsService.startRental).toHaveBeenCalledWith('b1', 'u2');
    });
  });

  // ── return flow ──
  describe('requestReturn', () => {
    it('delegates to service', async () => {
      bookingsService.requestReturn.mockResolvedValue(mockBooking as any);
      await controller.requestReturn('b1', 'u1');
      expect(bookingsService.requestReturn).toHaveBeenCalledWith('b1', 'u1');
    });
  });

  describe('approveReturn', () => {
    it('delegates to service', async () => {
      bookingsService.approveReturn.mockResolvedValue(mockBooking as any);
      await controller.approveReturn('b1', 'u2');
      expect(bookingsService.approveReturn).toHaveBeenCalledWith('b1', 'u2');
    });
  });

  describe('rejectReturn', () => {
    it('passes reason from dto', async () => {
      bookingsService.rejectReturn.mockResolvedValue(mockBooking as any);
      await controller.rejectReturn('b1', 'u2', { reason: 'Damaged' } as any);
      expect(bookingsService.rejectReturn).toHaveBeenCalledWith('b1', 'u2', 'Damaged');
    });
  });

  // ── initiateDispute ──
  describe('initiateDispute', () => {
    it('passes reason from dto', async () => {
      bookingsService.initiateDispute.mockResolvedValue({} as any);
      await controller.initiateDispute('b1', 'u1', { reason: 'Missing item' } as any);
      expect(bookingsService.initiateDispute).toHaveBeenCalledWith('b1', 'u1', 'Missing item');
    });
  });

  // ── getStats ──
  describe('getStats', () => {
    it('delegates to getBookingStats', async () => {
      const stats = { timeline: [] };
      bookingsService.getBookingStats.mockResolvedValue(stats as any);
      expect(await controller.getStats('b1', 'user-1')).toBe(stats);
    });
  });

  // ── getBlockedDates ──
  describe('getBlockedDates', () => {
    it('delegates to service (public endpoint)', async () => {
      const dates = ['2025-01-01'];
      bookingsService.getBlockedDates.mockResolvedValue(dates as any);
      expect(await controller.getBlockedDates('l1')).toBe(dates);
    });
  });

  // ── calculatePrice ──
  describe('calculatePrice', () => {
    it('returns structured price breakdown', async () => {
      calculation.calculatePrice.mockResolvedValue({
        subtotal: 500,
        serviceFee: 50,
        platformFee: 25,
        depositAmount: 100,
        total: 650,
        breakdown: { discounts: [{ type: 'weekly', amount: 50 }] },
      } as any);

      const result = await controller.calculatePrice({
        listingId: 'l1',
        startDate: '2025-01-01',
        endDate: '2025-01-06',
      } as any);

      expect(result).toHaveProperty('totalDays', 5);
      expect(result).toHaveProperty('subtotal', 500);
      expect(result).toHaveProperty('serviceFee', 50);
      expect(result).toHaveProperty('securityDeposit', 100);
      expect(result).toHaveProperty('totalAmount', 650);
      expect(result.breakdown).toHaveProperty('weeklyDiscount', 50);
    });
  });

  // ── getAvailableTransitions ──
  describe('getAvailableTransitions', () => {
    it('identifies user as RENTER when matching renterId', async () => {
      bookingsService.findById.mockResolvedValue({
        ...mockBooking,
        renterId: 'u1',
        listing: { ownerId: 'u2' },
      } as any);
      stateMachine.getAvailableTransitions.mockReturnValue([]);
      const result = await controller.getAvailableTransitions('b1', 'u1');
      expect(result.role).toBe('RENTER');
      expect(stateMachine.getAvailableTransitions).toHaveBeenCalledWith('PENDING', 'RENTER');
    });

    it('identifies user as OWNER when matching ownerId', async () => {
      bookingsService.findById.mockResolvedValue({
        ...mockBooking,
        renterId: 'u1',
        listing: { ownerId: 'u2' },
      } as any);
      stateMachine.getAvailableTransitions.mockReturnValue([]);
      const result = await controller.getAvailableTransitions('b1', 'u2');
      expect(result.role).toBe('OWNER');
    });

    it('defaults to ADMIN for unknown users', async () => {
      bookingsService.findById.mockResolvedValue({
        ...mockBooking,
        renterId: 'u1',
        listing: { ownerId: 'u2' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      stateMachine.getAvailableTransitions.mockReturnValue([]);
      const result = await controller.getAvailableTransitions('b1', 'u-admin');
      expect(result.role).toBe('ADMIN');
    });
  });

  // ── getInvoice ──
  describe('getInvoice', () => {
    it('returns JSON when format=json', async () => {
      const data = { invoiceNumber: 'INV-001', total: 1000 };
      invoiceService.getInvoiceData.mockResolvedValue(data as any);
      const res = { json: jest.fn(), setHeader: jest.fn(), send: jest.fn() } as any;
      await controller.getInvoice('b1', 'u1', 'json', res);
      expect(res.json).toHaveBeenCalledWith(data);
    });

    it('returns HTML by default', async () => {
      const data = { invoiceNumber: 'INV-001', total: 1000 };
      invoiceService.getInvoiceData.mockResolvedValue(data as any);
      invoiceService.generateInvoiceHtml.mockReturnValue('<html>Invoice</html>');
      const res = { json: jest.fn(), setHeader: jest.fn(), send: jest.fn() } as any;
      await controller.getInvoice('b1', 'u1', 'html', res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalledWith('<html>Invoice</html>');
    });
  });
});
