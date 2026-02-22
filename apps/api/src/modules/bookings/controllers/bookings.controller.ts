import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from '../services/bookings.service';
import {
  CreateBookingDto,
  RejectBookingDto,
  RejectReturnDto,
  CancelBookingDto,
  InitiateDisputeDto,
  CalculatePriceDto,
} from '../dto/booking.dto';
import { BookingStateMachineService } from '../services/booking-state-machine.service';
import { BookingCalculationService } from '../services/booking-calculation.service';
import { InvoiceService } from '../services/invoice.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { BookingStatus } from '@rental-portal/database';

type AsyncMethodResult<T extends (...args: any[]) => Promise<any>> = Awaited<ReturnType<T>>;

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly calculation: BookingCalculationService,
    private readonly invoiceService: InvoiceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or listing not available' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<AsyncMethodResult<BookingsService['create']>> {
    return this.bookingsService.create(userId, dto);
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user bookings as renter' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  async getMyBookings(
    @CurrentUser('id') userId: string,
    @Query('status') status?: BookingStatus,
  ): Promise<AsyncMethodResult<BookingsService['getRenterBookings']>> {
    return this.bookingsService.getRenterBookings(userId, status);
  }

  @Get('host-bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user bookings as owner/host' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  async getHostBookings(
    @CurrentUser('id') userId: string,
    @Query('status') status?: BookingStatus,
  ): Promise<AsyncMethodResult<BookingsService['getOwnerBookings']>> {
    return this.bookingsService.getOwnerBookings(userId, status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking details' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<BookingsService['findById']>> {
    return this.bookingsService.findById(id, true, userId);
  }

  @Get(':id/disputes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get disputes for a booking' })
  @ApiResponse({ status: 200, description: 'Disputes retrieved successfully' })
  async getBookingDisputes(
    @Param('id') bookingId: string,
    @CurrentUser('id') userId: string,
  ) {
    // Verify user has access to this booking
    await this.bookingsService.findById(bookingId, false, userId);
    return this.prisma.dispute.findMany({
      where: { bookingId },
      include: {
        initiator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve booking (owner only)' })
  @ApiResponse({ status: 200, description: 'Booking approved' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<BookingsService['approveBooking']>> {
    return this.bookingsService.approveBooking(id, userId);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject booking (owner only)' })
  @ApiResponse({ status: 200, description: 'Booking rejected' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RejectBookingDto,
  ): Promise<AsyncMethodResult<BookingsService['rejectBooking']>> {
    return this.bookingsService.rejectBooking(id, userId, dto.reason);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CancelBookingDto,
  ): Promise<AsyncMethodResult<BookingsService['cancelBooking']>> {
    return this.bookingsService.cancelBooking(id, userId, dto.reason);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start rental period' })
  @ApiResponse({ status: 200, description: 'Rental started' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async startRental(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<BookingsService['startRental']>> {
    return this.bookingsService.startRental(id, userId);
  }

  @Post(':id/request-return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request return inspection (renter)' })
  @ApiResponse({ status: 200, description: 'Return requested' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async requestReturn(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<BookingsService['requestReturn']>> {
    return this.bookingsService.requestReturn(id, userId);
  }

  @Post(':id/approve-return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve return (owner)' })
  @ApiResponse({ status: 200, description: 'Return approved' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async approveReturn(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<BookingsService['approveReturn']>> {
    return this.bookingsService.approveReturn(id, userId);
  }

  @Post(':id/reject-return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject return — report issues found during inspection (owner)' })
  @ApiResponse({ status: 200, description: 'Return rejected, booking moved to DISPUTED' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async rejectReturn(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RejectReturnDto,
  ): Promise<AsyncMethodResult<BookingsService['rejectReturn']>> {
    return this.bookingsService.rejectReturn(id, userId, dto.reason);
  }

  @Post(':id/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate dispute' })
  @ApiResponse({ status: 200, description: 'Dispute initiated' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async initiateDispute(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InitiateDisputeDto,
  ): Promise<AsyncMethodResult<BookingsService['initiateDispute']>> {
    return this.bookingsService.initiateDispute(id, userId, dto.reason);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking statistics and timeline' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(@Param('id') id: string) {
    return this.bookingsService.getBookingStats(id);
  }

  @Get('blocked-dates/:listingId')
  @ApiOperation({ summary: 'Get blocked dates for a listing' })
  @ApiResponse({ status: 200, description: 'Blocked dates retrieved' })
  async getBlockedDates(@Param('listingId') listingId: string) {
    return this.bookingsService.getBlockedDates(listingId);
  }

  @Post('calculate-price')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate booking price' })
  @ApiResponse({ status: 200, description: 'Price calculated' })
  async calculatePrice(
    @Body() dto: CalculatePriceDto,
  ) {
    const calculation = await this.calculation.calculatePrice(
      dto.listingId,
      new Date(dto.startDate),
      new Date(dto.endDate),
    );

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const pricePerDay = totalDays > 0 ? calculation.subtotal / totalDays : calculation.subtotal;

    const weeklyDiscount = calculation.breakdown.discounts?.find((d) => d.type === 'weekly');
    const monthlyDiscount = calculation.breakdown.discounts?.find((d) => d.type === 'monthly');

    return {
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalDays,
      pricePerDay,
      subtotal: calculation.subtotal,
      serviceFee: calculation.serviceFee,
      deliveryFee: 0,
      securityDeposit: calculation.depositAmount,
      totalAmount: calculation.total,
      breakdown: {
        dailyRental: calculation.subtotal,
        weeklyDiscount: weeklyDiscount?.amount,
        monthlyDiscount: monthlyDiscount?.amount,
        platformFee: calculation.platformFee,
        taxes: 0,
      },
    };
  }

  @Get(':id/available-transitions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available state transitions for booking' })
  @ApiResponse({ status: 200, description: 'Available transitions retrieved' })
  async getAvailableTransitions(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const booking = (await this.bookingsService.findById(id)) as any;

    // Determine user role
    let role: 'RENTER' | 'OWNER' | 'ADMIN';
    if (booking.renterId === userId) {
      role = 'RENTER';
    } else if (booking.listing.ownerId === userId) {
      role = 'OWNER';
    } else {
      role = 'ADMIN';
    }

    const transitions = this.stateMachine.getAvailableTransitions(booking.status, role);

    return {
      currentState: booking.status,
      role,
      availableTransitions: transitions,
    };
  }

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking invoice as HTML (or JSON with ?format=json)' })
  async getInvoice(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.invoiceService.getInvoiceData(id, userId);

    if (format === 'json') {
      res.json(data);
      return;
    }

    const html = this.invoiceService.generateInvoiceHtml(data);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${data.invoiceNumber}.html"`);
    res.send(html);
  }
}
