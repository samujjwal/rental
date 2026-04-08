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
            getConditionReports: jest.fn(),
            updateConditionReport: jest.fn(),
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

    it('should validate booking creation with invalid dates', async () => {
      bookingsService.create.mockRejectedValue(new Error('Invalid date range'));
      const dto = { listingId: 'l1', startDate: '2025-01-05', endDate: '2025-01-01' } as any;
      await expect(controller.create('u1', dto)).rejects.toThrow('Invalid date range');
      expect(bookingsService.create).toHaveBeenCalledWith('u1', dto);
    });

    it('should handle booking conflicts', async () => {
      bookingsService.create.mockRejectedValue(new Error('Listing not available for selected dates'));
      const dto = { listingId: 'l1', startDate: '2025-01-01', endDate: '2025-01-05' } as any;
      await expect(controller.create('u1', dto)).rejects.toThrow('Listing not available for selected dates');
    });

    it('should validate required fields', async () => {
      const dto = { startDate: '2025-01-01' } as any;
      bookingsService.create.mockRejectedValue(new Error('Missing required fields'));
      await expect(controller.create('u1', dto)).rejects.toThrow('Missing required fields');
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

    it('should handle unauthorized approval attempts', async () => {
      bookingsService.approveBooking.mockRejectedValue(new ForbiddenException('Not authorized to approve this booking'));
      await expect(controller.approve('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should handle approval of already approved bookings', async () => {
      bookingsService.approveBooking.mockRejectedValue(new Error('Booking is already approved'));
      await expect(controller.approve('b1', 'u2')).rejects.toThrow('Booking is already approved');
    });
  });

  describe('reject', () => {
    it('passes reason from dto', async () => {
      bookingsService.rejectBooking.mockResolvedValue(mockBooking as any);
      await controller.reject('b1', 'u2', { reason: 'Not available' } as any);
      expect(bookingsService.rejectBooking).toHaveBeenCalledWith('b1', 'u2', 'Not available');
    });

    it('should handle empty rejection reason', async () => {
      bookingsService.rejectBooking.mockRejectedValue(new Error('Rejection reason is required'));
      await expect(controller.reject('b1', 'u2', { reason: '' } as any)).rejects.toThrow('Rejection reason is required');
    });

    it('should handle unauthorized rejection attempts', async () => {
      bookingsService.rejectBooking.mockRejectedValue(new ForbiddenException('Not authorized to reject this booking'));
      await expect(controller.reject('b1', 'u1', { reason: 'Not available' } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('passes reason from dto', async () => {
      bookingsService.cancelBooking.mockResolvedValue(mockBooking as any);
      await controller.cancel('b1', 'u1', { reason: 'Changed plans' } as any);
      expect(bookingsService.cancelBooking).toHaveBeenCalledWith('b1', 'u1', 'Changed plans');
    });

    it('should handle cancellation of non-cancellable bookings', async () => {
      bookingsService.cancelBooking.mockRejectedValue(new Error('Booking cannot be cancelled in current status'));
      await expect(controller.cancel('b1', 'u1', { reason: 'Changed plans' } as any)).rejects.toThrow('Booking cannot be cancelled in current status');
    });

    it('should handle unauthorized cancellation attempts', async () => {
      bookingsService.cancelBooking.mockRejectedValue(new ForbiddenException('Not authorized to cancel this booking'));
      await expect(controller.cancel('b1', 'u3', { reason: 'Changed plans' } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── booking modification tests (placeholder for future implementation) ──
  describe('booking modification', () => {
    it('should handle booking date modification requests', async () => {
      // This test is a placeholder for future implementation
      // When updateBooking endpoint is added, this test should be updated
      const modificationDto = { newStartDate: '2025-01-02', newEndDate: '2025-01-06' } as any;
      
      // Mock the future endpoint
      const mockUpdateBooking = jest.fn().mockResolvedValue(mockBooking);
      await expect(mockUpdateBooking('b1', 'u1', modificationDto)).resolves.toBe(mockBooking);
    });

    it('should validate modification date availability', async () => {
      // This test is a placeholder for future implementation
      const modificationDto = { newStartDate: '2025-01-02', newEndDate: '2025-01-06' } as any;
      
      // Mock the future endpoint with error
      const mockUpdateBooking = jest.fn().mockRejectedValue(new Error('New dates not available'));
      await expect(mockUpdateBooking('b1', 'u1', modificationDto)).rejects.toThrow('New dates not available');
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

    it('should handle unauthorized rental start attempts', async () => {
      bookingsService.startRental.mockRejectedValue(new ForbiddenException('Not authorized to start rental'));
      await expect(controller.startRental('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should handle premature rental start', async () => {
      bookingsService.startRental.mockRejectedValue(new Error('Rental period has not started yet'));
      await expect(controller.startRental('b1', 'u2')).rejects.toThrow('Rental period has not started yet');
    });

    it('should handle rental start for non-approved bookings', async () => {
      bookingsService.startRental.mockRejectedValue(new Error('Booking must be approved before starting rental'));
      await expect(controller.startRental('b1', 'u2')).rejects.toThrow('Booking must be approved before starting rental');
    });
  });

  // ── return flow ──
  describe('requestReturn', () => {
    it('delegates to service', async () => {
      bookingsService.requestReturn.mockResolvedValue(mockBooking as any);
      await controller.requestReturn('b1', 'u1');
      expect(bookingsService.requestReturn).toHaveBeenCalledWith('b1', 'u1');
    });

    it('should handle unauthorized return requests', async () => {
      bookingsService.requestReturn.mockRejectedValue(new ForbiddenException('Only renter can request return'));
      await expect(controller.requestReturn('b1', 'u2')).rejects.toThrow(ForbiddenException);
    });

    it('should handle return requests for non-active rentals', async () => {
      bookingsService.requestReturn.mockRejectedValue(new Error('Rental is not currently active'));
      await expect(controller.requestReturn('b1', 'u1')).rejects.toThrow('Rental is not currently active');
    });
  });

  describe('approveReturn', () => {
    it('delegates to service', async () => {
      bookingsService.approveReturn.mockResolvedValue(mockBooking as any);
      await controller.approveReturn('b1', 'u2');
      expect(bookingsService.approveReturn).toHaveBeenCalledWith('b1', 'u2');
    });

    it('should handle unauthorized return approval', async () => {
      bookingsService.approveReturn.mockRejectedValue(new ForbiddenException('Only owner can approve return'));
      await expect(controller.approveReturn('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should handle return approval without return request', async () => {
      bookingsService.approveReturn.mockRejectedValue(new Error('No return request pending'));
      await expect(controller.approveReturn('b1', 'u2')).rejects.toThrow('No return request pending');
    });
  });

  describe('rejectReturn', () => {
    it('passes reason from dto', async () => {
      bookingsService.rejectReturn.mockResolvedValue(mockBooking as any);
      await controller.rejectReturn('b1', 'u2', { reason: 'Damaged' } as any);
      expect(bookingsService.rejectReturn).toHaveBeenCalledWith('b1', 'u2', 'Damaged');
    });

    it('should handle empty rejection return reason', async () => {
      bookingsService.rejectReturn.mockRejectedValue(new Error('Rejection reason is required'));
      await expect(controller.rejectReturn('b1', 'u2', { reason: '' } as any)).rejects.toThrow('Rejection reason is required');
    });

    it('should handle unauthorized return rejection', async () => {
      bookingsService.rejectReturn.mockRejectedValue(new ForbiddenException('Only owner can reject return'));
      await expect(controller.rejectReturn('b1', 'u1', { reason: 'Damaged' } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── initiateDispute ──
  describe('initiateDispute', () => {
    it('passes reason from dto', async () => {
      bookingsService.initiateDispute.mockResolvedValue({} as any);
      await controller.initiateDispute('b1', 'u1', { reason: 'Missing item' } as any);
      expect(bookingsService.initiateDispute).toHaveBeenCalledWith('b1', 'u1', 'Missing item');
    });

    it('should handle empty dispute reason', async () => {
      bookingsService.initiateDispute.mockRejectedValue(new Error('Dispute reason is required'));
      await expect(controller.initiateDispute('b1', 'u1', { reason: '' } as any)).rejects.toThrow('Dispute reason is required');
    });

    it('should handle dispute initiation for completed bookings only', async () => {
      bookingsService.initiateDispute.mockRejectedValue(new Error('Disputes can only be initiated for completed bookings'));
      await expect(controller.initiateDispute('b1', 'u1', { reason: 'Missing item' } as any)).rejects.toThrow('Disputes can only be initiated for completed bookings');
    });

    it('should handle unauthorized dispute initiation', async () => {
      bookingsService.initiateDispute.mockRejectedValue(new ForbiddenException('Not authorized to initiate dispute for this booking'));
      await expect(controller.initiateDispute('b1', 'u3', { reason: 'Missing item' } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── permission checks tests ──
  describe('permission checks', () => {
    it('should prevent renters from accessing owner-only endpoints', async () => {
      bookingsService.approveBooking.mockRejectedValue(new ForbiddenException('Only owners can approve bookings'));
      await expect(controller.approve('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });

    it('should prevent owners from accessing renter-only endpoints', async () => {
      bookingsService.requestReturn.mockRejectedValue(new ForbiddenException('Only renters can request return'));
      await expect(controller.requestReturn('b1', 'u2')).rejects.toThrow(ForbiddenException);
    });

    it('should prevent unauthorized users from accessing booking details', async () => {
      bookingsService.findById.mockRejectedValue(new ForbiddenException('Not authorized to view this booking'));
      await expect(controller.findById('b1', 'u3')).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin access to all bookings', async () => {
      const adminBooking = { ...mockBooking, renterId: 'u1', ownerId: 'u2' };
      bookingsService.findById.mockResolvedValue(adminBooking as any);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      
      await expect(controller.findById('b1', 'admin-user')).resolves.toBe(adminBooking);
      expect(bookingsService.findById).toHaveBeenCalledWith('b1', true, 'admin-user');
    });
  });

  // ── state transition validation tests ──
  describe('state transitions', () => {
    it('should validate valid state transitions', async () => {
      const validTransitions = ['APPROVE' as any, 'REJECT' as any, 'CANCEL' as any];
      stateMachine.getAvailableTransitions.mockReturnValue(validTransitions);
      bookingsService.findById.mockResolvedValue({ ...mockBooking, status: 'PENDING' } as any);
      
      const result = await controller.getAvailableTransitions('b1', 'u2');
      expect(result.availableTransitions).toEqual(validTransitions);
      expect(stateMachine.getAvailableTransitions).toHaveBeenCalledWith('PENDING', 'OWNER');
    });

    it('should handle invalid state transitions', async () => {
      stateMachine.getAvailableTransitions.mockReturnValue([]);
      bookingsService.findById.mockResolvedValue({ ...mockBooking, status: 'COMPLETED' } as any);
      
      const result = await controller.getAvailableTransitions('b1', 'u2');
      expect(result.availableTransitions).toEqual([]);
    });

    it('should prevent state transitions for unauthorized users', async () => {
      bookingsService.approveBooking.mockRejectedValue(new ForbiddenException('Not authorized to perform this action'));
      await expect(controller.approve('b1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── error scenario tests ──
  describe('error scenarios', () => {
    it('should handle database connection errors', async () => {
      bookingsService.create.mockRejectedValue(new Error('Database connection failed'));
      const dto = { listingId: 'l1', startDate: '2025-01-01', endDate: '2025-01-05' } as any;
      await expect(controller.create('u1', dto)).rejects.toThrow('Database connection failed');
    });

    it('should handle service unavailability errors', async () => {
      calculation.calculatePrice.mockRejectedValue(new Error('Pricing service unavailable'));
      const dto = { listingId: 'l1', startDate: '2025-01-01', endDate: '2025-01-05' } as any;
      await expect(controller.calculatePrice(dto)).rejects.toThrow('Pricing service unavailable');
    });

    it('should handle malformed request data', async () => {
      const invalidDto = { listingId: null, startDate: 'invalid-date', endDate: '2025-01-05' } as any;
      bookingsService.create.mockRejectedValue(new Error('Invalid request data'));
      await expect(controller.create('u1', invalidDto)).rejects.toThrow('Invalid request data');
    });

    it('should handle concurrent booking conflicts', async () => {
      bookingsService.create.mockRejectedValue(new Error('Booking conflict: Another booking exists for these dates'));
      const dto = { listingId: 'l1', startDate: '2025-01-01', endDate: '2025-01-05' } as any;
      await expect(controller.create('u1', dto)).rejects.toThrow('Booking conflict: Another booking exists for these dates');
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
