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
  ForbiddenException,
} from '@nestjs/common';
import { i18nForbidden } from '@/common/errors/i18n-exceptions';
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
  UpdateConditionReportDto,
} from '../dto/booking.dto';
import { BookingStateMachineService } from '../services/booking-state-machine.service';
import { BookingCalculationService } from '../services/booking-calculation.service';
import { InvoiceService } from '../services/invoice.service';
import { PolicyEngineService } from '../../policy-engine/services/policy-engine.service';
import { ContextResolverService } from '../../policy-engine/services/context-resolver.service';
import { JwtAuthGuard, CurrentUser } from '@/common/auth';
import { EmailVerifiedGuard, RequireEmailVerification } from '@/common/guards/email-verified.guard';
import { PrismaService } from '@/common/prisma/prisma.service';
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
    private readonly policyEngine: PolicyEngineService,
    private readonly contextResolver: ContextResolverService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @RequireEmailVerification()
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<AsyncMethodResult<BookingsService['getRenterBookings']>> {
    return this.bookingsService.getRenterBookings(
      userId,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
  }

  @Get('host-bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user bookings as owner/host' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  async getHostBookings(
    @CurrentUser('id') userId: string,
    @Query('status') status?: BookingStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<AsyncMethodResult<BookingsService['getOwnerBookings']>> {
    return this.bookingsService.getOwnerBookings(
      userId,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
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
  ): Promise<any[]> {
    return this.bookingsService.getBookingDisputes(bookingId, userId);
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

  @Post(':id/bypass-confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST ONLY] Bypass Stripe payment and confirm booking (requires STRIPE_TEST_BYPASS=true)' })
  @ApiResponse({ status: 200, description: 'Booking confirmed via test bypass' })
  @ApiResponse({ status: 403, description: 'Not available outside test mode or not authorized' })
  async bypassConfirm(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<AsyncMethodResult<BookingStateMachineService['transition']>> {
    if (process.env['STRIPE_TEST_BYPASS'] !== 'true') {
      throw new ForbiddenException('bypass-confirm is only available when STRIPE_TEST_BYPASS=true');
    }
    // Use SYSTEM role so either the renter or owner token can call this endpoint.
    return this.stateMachine.transition(id, 'COMPLETE_PAYMENT', userId, 'SYSTEM');
  }

  @Post('dev-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TEST ONLY] Force-cancel all non-final bookings (requires STRIPE_TEST_BYPASS=true)' })
  @ApiResponse({ status: 200, description: 'All non-final bookings cancelled' })
  @ApiResponse({ status: 403, description: 'Not available outside test mode' })
  async devReset(): Promise<{ cancelled: number }> {
    if (process.env['STRIPE_TEST_BYPASS'] !== 'true') {
      throw new ForbiddenException('dev-reset is only available when STRIPE_TEST_BYPASS=true');
    }
    // Cancel ALL bookings (including COMPLETED/SETTLED) so prior-run date slots
    // never conflict with upcoming test bookings. The conflict check treats
    // COMPLETED and SETTLED as blocking, so they must be cleared too.
    const result = await this.prisma.booking.updateMany({
      where: {
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] },
      },
      data: { status: BookingStatus.CANCELLED },
    });
    return { cancelled: result.count };
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
  async getStats(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.getBookingStats(id, userId);
  }

  @Get(':id/condition-reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get condition reports for a booking' })
  @ApiResponse({ status: 200, description: 'Condition reports retrieved' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async getConditionReports(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.bookingsService.getConditionReports(id, userId);
  }

  @Patch(':id/condition-reports/:reportId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a condition report (photos, notes, damages, signature)' })
  @ApiResponse({ status: 200, description: 'Condition report updated' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Condition report not found' })
  async updateConditionReport(
    @Param('id') id: string,
    @Param('reportId') reportId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateConditionReportDto,
  ) {
    return this.bookingsService.updateConditionReport(id, reportId, userId, dto);
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
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const pricing = await this.calculation.calculatePrice(dto.listingId, startDate, endDate);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    const discounts = pricing.breakdown.discounts ?? [];
    const discountTotal = discounts.reduce((total, discount) => total + discount.amount, 0);
    const basePrice =
      typeof pricing.breakdown.basePrice === 'number'
        ? pricing.breakdown.basePrice
        : pricing.subtotal + discountTotal;

    return {
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalDays,
      pricePerDay: totalDays > 0 ? basePrice / totalDays : basePrice,
      subtotal: pricing.subtotal,
      serviceFee: pricing.serviceFee,
      platformFee: pricing.platformFee,
      deliveryFee: 0,
      securityDeposit: pricing.depositAmount,
      totalAmount: pricing.total,
      ownerEarnings: pricing.ownerEarnings,
      breakdown: {
        dailyRental: basePrice,
        weeklyDiscount: discounts.find((discount) => discount.type === 'weekly')?.amount ?? 0,
        monthlyDiscount: discounts.find((discount) => discount.type === 'monthly')?.amount ?? 0,
        platformFee: pricing.platformFee,
        taxes: 0,
        taxLines: [] as Array<{ name: string; amount: number }>,
        discounts,
      },
    };
  }

  @Get(':id/available-transitions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available state transitions for booking' })
  @ApiResponse({ status: 200, description: 'Available transitions retrieved' })
  async getAvailableTransitions(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const booking = await this.bookingsService.findById(id);

    // Determine user role
    let role: 'RENTER' | 'OWNER' | 'ADMIN';
    if (booking.renterId === userId) {
      role = 'RENTER';
    } else if (booking.ownerId === userId || booking.listing?.ownerId === userId) {
      role = 'OWNER';
    } else {
      // Verify the user actually has an admin role before granting admin access
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'];
      if (!user || !adminRoles.includes(user.role)) {
        throw i18nForbidden('booking.unauthorizedAction');
      }
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
