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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService, CreateBookingDto } from '../services/bookings.service';
import { BookingStateMachineService } from '../services/booking-state-machine.service';
import { BookingCalculationService } from '../services/booking-calculation.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { BookingStatus } from '@rental-portal/database';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly calculation: BookingCalculationService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or listing not available' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(userId, dto);
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user bookings as renter' })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  async getMyBookings(@CurrentUser('id') userId: string, @Query('status') status?: BookingStatus) {
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
  ) {
    return this.bookingsService.getOwnerBookings(userId, status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking details' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findById(@Param('id') id: string) {
    return this.bookingsService.findById(id, true);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve booking (owner only)' })
  @ApiResponse({ status: 200, description: 'Booking approved' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
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
    @Body('reason') reason?: string,
  ) {
    return this.bookingsService.rejectBooking(id, userId, reason);
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
    @Body('reason') reason?: string,
  ) {
    return this.bookingsService.cancelBooking(id, userId, reason);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start rental period' })
  @ApiResponse({ status: 200, description: 'Rental started' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async startRental(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.startRental(id, userId);
  }

  @Post(':id/request-return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request return inspection (renter)' })
  @ApiResponse({ status: 200, description: 'Return requested' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async requestReturn(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.requestReturn(id, userId);
  }

  @Post(':id/approve-return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve return (owner)' })
  @ApiResponse({ status: 200, description: 'Return approved' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async approveReturn(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.bookingsService.approveReturn(id, userId);
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
    @Body('reason') reason: string,
  ) {
    return this.bookingsService.initiateDispute(id, userId, reason);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking statistics and timeline' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(@Param('id') id: string) {
    return this.bookingsService.getBookingStats(id);
  }

  @Post('calculate-price')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate booking price' })
  @ApiResponse({ status: 200, description: 'Price calculated' })
  async calculatePrice(
    @Body('listingId') listingId: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    return this.calculation.calculatePrice(listingId, new Date(startDate), new Date(endDate));
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
}
