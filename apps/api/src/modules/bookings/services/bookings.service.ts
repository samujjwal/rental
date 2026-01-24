import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { Booking, BookingStatus, BookingMode } from '@rental-portal/database';
import { AvailabilityService } from '@/modules/listings/services/availability.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingCalculationService } from './booking-calculation.service';

export interface CreateBookingDto {
  listingId: string;
  startDate: Date;
  endDate: Date;
  guestCount?: number;
  message?: string;
  promoCode?: string;
}

export interface UpdateBookingDto {
  startDate?: Date;
  endDate?: Date;
  guestCount?: number;
  message?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly availabilityService: AvailabilityService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly calculation: BookingCalculationService,
  ) {}

  async create(renterId: string, dto: CreateBookingDto): Promise<Booking> {
    // Validate listing exists and is bookable
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: { owner: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== 'ACTIVE') {
      throw new BadRequestException('Listing is not available for booking');
    }

    if (listing.ownerId === renterId) {
      throw new BadRequestException('Cannot book your own listing');
    }

    // Check availability
    const availabilityCheck = await this.availabilityService.checkAvailability({
      listingId: dto.listingId,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    if (!availabilityCheck.isAvailable) {
      throw new BadRequestException({
        message: 'Listing not available for selected dates',
        conflicts: availabilityCheck.conflicts,
      });
    }

    // Calculate pricing
    const pricing = await this.calculation.calculatePrice(
      dto.listingId,
      dto.startDate,
      dto.endDate,
    );

    // Determine initial status based on booking mode
    let initialStatus: BookingStatus;
    if (listing.bookingMode === BookingMode.INSTANT) {
      initialStatus = BookingStatus.PENDING_PAYMENT;
    } else {
      initialStatus = BookingStatus.PENDING_OWNER_APPROVAL;
    }

    // Create booking
    const booking = await this.prisma.booking.create({
      data: {
        renterId,
        listingId: dto.listingId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        guestCount: dto.guestCount,
        renterMessage: dto.message,
        status: initialStatus,
        subtotal: pricing.subtotal,
        platformFee: pricing.platformFee,
        serviceFee: pricing.serviceFee,
        depositAmount: pricing.depositAmount,
        totalAmount: pricing.total,
        ownerEarnings: pricing.ownerEarnings,
        currency: listing.currency,
        stateHistory: {
          create: {
            state: initialStatus,
            transitionedBy: renterId,
            metadata: {
              bookingMode: listing.bookingMode,
              pricing: pricing.breakdown,
            },
          },
        },
      },
      include: {
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            averageRating: true,
          },
        },
        listing: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
            category: true,
          },
        },
      },
    });

    // Send notification to owner
    await this.cacheService.publish('booking:created', {
      bookingId: booking.id,
      renterId,
      ownerId: listing.ownerId,
      listingId: dto.listingId,
      status: initialStatus,
    });

    return booking;
  }

  async findById(id: string, includePrivate: boolean = false): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            email: includePrivate,
            phone: includePrivate,
            averageRating: true,
            totalReviews: true,
          },
        },
        listing: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
                email: includePrivate,
                phone: includePrivate,
                averageRating: true,
              },
            },
            category: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async getRenterBookings(renterId: string, status?: BookingStatus): Promise<Booking[]> {
    const where: any = { renterId };
    if (status) where.status = status;

    return this.prisma.booking.findMany({
      where,
      include: {
        listing: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
              },
            },
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOwnerBookings(ownerId: string, status?: BookingStatus): Promise<Booking[]> {
    const where: any = {
      listing: { ownerId },
    };
    if (status) where.status = status;

    return this.prisma.booking.findMany({
      where,
      include: {
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            averageRating: true,
          },
        },
        listing: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveBooking(bookingId: string, ownerId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized to approve this booking');
    }

    await this.stateMachine.transition(bookingId, 'OWNER_APPROVE', ownerId, 'OWNER');

    return this.findById(bookingId);
  }

  async rejectBooking(bookingId: string, ownerId: string, reason?: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized to reject this booking');
    }

    await this.stateMachine.transition(bookingId, 'OWNER_REJECT', ownerId, 'OWNER', { reason });

    return this.findById(bookingId);
  }

  async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to cancel this booking');
    }

    // Calculate refund
    const refund = await this.calculation.calculateRefund(bookingId, new Date());

    await this.stateMachine.transition(
      bookingId,
      'CANCEL',
      userId,
      booking.renterId === userId ? 'RENTER' : 'OWNER',
      { reason, refund },
    );

    return this.findById(bookingId);
  }

  async startRental(bookingId: string, userId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to start this rental');
    }

    await this.stateMachine.transition(
      bookingId,
      'START_RENTAL',
      userId,
      booking.renterId === userId ? 'RENTER' : 'OWNER',
    );

    return this.findById(bookingId);
  }

  async requestReturn(bookingId: string, renterId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== renterId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.stateMachine.transition(bookingId, 'REQUEST_RETURN', renterId, 'RENTER');

    return this.findById(bookingId);
  }

  async approveReturn(bookingId: string, ownerId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.stateMachine.transition(bookingId, 'APPROVE_RETURN', ownerId, 'OWNER');

    return this.findById(bookingId);
  }

  async initiateDispute(bookingId: string, userId: string, reason: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.stateMachine.transition(
      bookingId,
      'INITIATE_DISPUTE',
      userId,
      booking.renterId === userId ? 'RENTER' : 'OWNER',
      { reason },
    );

    return this.findById(bookingId);
  }

  async getBookingStats(bookingId: string) {
    const booking = await this.findById(bookingId);
    const history = await this.stateMachine.getStateHistory(bookingId);

    return {
      booking,
      stateHistory: history,
      timeline: this.generateTimeline(booking, history),
    };
  }

  private generateTimeline(booking: Booking, history: any[]) {
    return history.map((h) => ({
      state: h.state,
      timestamp: h.transitionedAt,
      actor: h.transitionedByUser,
      metadata: h.metadata,
    }));
  }
}
