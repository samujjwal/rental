import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { Booking, BookingStatus, BookingMode, toNumber } from '@rental-portal/database';
import { AvailabilityService } from '@/modules/listings/services/availability.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingCalculationService } from './booking-calculation.service';
import { FraudDetectionService } from '@/modules/fraud-detection/services/fraud-detection.service';
import { InsuranceService } from '@/modules/insurance/services/insurance.service';
import { ContentModerationService } from '@/modules/moderation/services/content-moderation.service';

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
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly availabilityService: AvailabilityService,
    private readonly stateMachine: BookingStateMachineService,
    private readonly calculation: BookingCalculationService,
    private readonly fraudDetection: FraudDetectionService,
    private readonly insuranceService: InsuranceService,
    private readonly moderationService: ContentModerationService,
  ) {}

  async create(renterId: string, dto: CreateBookingDto): Promise<Booking> {
    const startDate =
      dto.startDate instanceof Date ? dto.startDate : new Date(dto.startDate as unknown as string);
    const endDate =
      dto.endDate instanceof Date ? dto.endDate : new Date(dto.endDate as unknown as string);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid booking dates');
    }

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate listing exists and is bookable
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: { owner: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== 'AVAILABLE') {
      throw new BadRequestException('Listing is not available for booking');
    }

    if (listing.ownerId === renterId) {
      throw new BadRequestException('Cannot book your own listing');
    }

    // Check for fraud
    const fraudCheck = await this.fraudDetection.checkUserRisk(renterId);
    if (!fraudCheck.allowBooking) {
        // Log this?
        throw new ForbiddenException('Booking rejected due to security policies');
    }

    // Check insurance requirement for this listing's category
    try {
      const insuranceReq = await this.insuranceService.checkInsuranceRequirement(dto.listingId);
      if (insuranceReq.required) {
        const hasInsurance = await this.insuranceService.hasValidInsurance(dto.listingId);
        if (!hasInsurance) {
          throw new BadRequestException({
            message: 'Insurance is required for this listing',
            reason: insuranceReq.reason || 'Category or value requires insurance coverage',
            insuranceRequired: true,
          });
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Insurance check failed for listing ${dto.listingId}, proceeding`, error);
    }

    // Moderate booking message if provided
    if (dto.message) {
      try {
        const moderation = await this.moderationService.moderateMessage(dto.message);
        if (moderation.status === 'REJECTED' || moderation.status === 'FLAGGED') {
          throw new BadRequestException({
            message: 'Your message contains content that violates our policies',
            flags: moderation.flags,
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.warn('Message moderation check failed, proceeding', error);
      }
    }

    // Calculate pricing first (outside transaction)
    const pricing = await this.calculation.calculatePrice(
      dto.listingId,
      startDate,
      endDate,
    );

    // Determine initial status based on booking mode
    let initialStatus: BookingStatus;
    // Corrected Enum usage matching Prisma Schema
    if (listing.bookingMode === BookingMode.INSTANT_BOOK) {
      initialStatus = BookingStatus.PENDING_PAYMENT;
    } else {
      initialStatus = BookingStatus.PENDING_OWNER_APPROVAL;
    }

    // Create booking within transaction to prevent race conditions
    const booking = (await this.prisma.$transaction(async (tx) => {
      // Check for conflicting bookings within the transaction
      const conflicts = await tx.booking.findMany({
        where: {
          listingId: dto.listingId,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
          },
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gte: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (conflicts.length > 0) {
        throw new BadRequestException({
          message: 'Listing not available for selected dates',
          conflicts: conflicts.map(c => ({
            startDate: c.startDate,
            endDate: c.endDate,
            bookingId: c.id,
          })),
        });
      }

      // Create booking atomically
      const bookingMetadata: Record<string, any> = {};
      if ((dto as any).deliveryMethod) {
        bookingMetadata.deliveryMethod = (dto as any).deliveryMethod;
      }
      if ((dto as any).deliveryAddress) {
        bookingMetadata.deliveryAddress = (dto as any).deliveryAddress;
      }

      return tx.booking.create({
        data: {
          renterId,
          listingId: dto.listingId,
          ownerId: listing.ownerId,
          startDate,
          endDate,
          guestCount: dto.guestCount,
          specialRequests: dto.message,
          metadata: Object.keys(bookingMetadata).length
            ? JSON.stringify(bookingMetadata)
            : undefined,
          status: initialStatus,
          basePrice: pricing.breakdown.basePrice,
          totalPrice: pricing.total,
          platformFee: pricing.platformFee,
          serviceFee: pricing.serviceFee,
          depositAmount: pricing.depositAmount,
          totalAmount: pricing.total,
          ownerEarnings: pricing.ownerEarnings,
          currency: listing.currency,
          stateHistory: {
            create: {
              toStatus: initialStatus,
              changedBy: renterId,
              reason: 'Booking created',
            },
          },
        } as any,
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
    })) as unknown as Booking;

    // Send notification to owner
    await this.cacheService.publish('booking:created', {
      bookingId: booking.id,
      renterId,
      ownerId: listing.ownerId,
      listingId: dto.listingId,
      status: initialStatus,
    });

    return this.attachPaymentStatus(booking);
  }

  async findById(id: string, includePrivate: boolean = false, userId?: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            reviewerId: true,
          },
        },
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

    // Authorization check if userId is provided
    if (userId && includePrivate) {
      const isRenter = booking.renterId === userId;
      const isOwner = (booking.listing as any).ownerId === userId;
      
      if (!isRenter && !isOwner) {
        // Check if user is admin
        const user = await this.prisma.user.findUnique({ 
          where: { id: userId },
          select: { role: true }
        });
        
        if (user?.role !== 'ADMIN') {
          throw new ForbiddenException('Not authorized to view this booking');
        }
      }
    }

    return this.attachPaymentStatus(booking, userId);
  }

  async getRenterBookings(renterId: string, status?: BookingStatus): Promise<Booking[]> {
    const where: any = { renterId };
    if (status) where.status = status;

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
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
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((booking) => this.attachPaymentStatus(booking));
  }

  async getOwnerBookings(ownerId: string, status?: BookingStatus): Promise<Booking[]> {
    const where: any = {
      listing: { ownerId },
    };
    if (status) where.status = status;

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
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

    return bookings.map((booking) => this.attachPaymentStatus(booking));
  }

  private attachPaymentStatus(booking: any, userId?: string): any {
    const latestPaymentStatus = booking?.payments?.[0]?.status as string | undefined;
    let paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED' = 'PENDING';

    if (latestPaymentStatus) {
      const upper = latestPaymentStatus.toUpperCase();
      if (upper === 'COMPLETED' || upper === 'SUCCEEDED') {
        paymentStatus = 'PAID';
      } else if (upper === 'REFUNDED') {
        paymentStatus = 'REFUNDED';
      } else if (upper === 'FAILED' || upper === 'CANCELLED') {
        paymentStatus = 'FAILED';
      } else {
        paymentStatus = 'PENDING';
      }
    } else {
      const bookingStatus = String(booking.status || '').toUpperCase();
      if (bookingStatus === 'REFUNDED') {
        paymentStatus = 'REFUNDED';
      } else if (bookingStatus === 'CANCELLED') {
        paymentStatus = 'FAILED';
      } else if (
        [
          'CONFIRMED',
          'IN_PROGRESS',
          'AWAITING_RETURN_INSPECTION',
          'COMPLETED',
          'SETTLED',
        ].includes(bookingStatus)
      ) {
        paymentStatus = 'PAID';
      } else {
        paymentStatus = 'PENDING';
      }
    }

    const startDate = booking.startDate ? new Date(booking.startDate) : null;
    const endDate = booking.endDate ? new Date(booking.endDate) : null;
    const totalDays =
      startDate && endDate
        ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000))
        : 0;
    const subtotal = toNumber(booking.basePrice) || 0;
    const serviceFee = toNumber(booking.serviceFee) || 0;
    const depositAmount = toNumber(booking.depositAmount) || 0;
    const securityDeposit = toNumber(booking.securityDeposit) || depositAmount;
    const totalAmount = toNumber(booking.totalAmount) || toNumber(booking.totalPrice) || 0;
    const pricePerDay = totalDays > 0 ? subtotal / totalDays : subtotal;

    let deliveryMethod: 'pickup' | 'delivery' | 'shipping' = 'pickup';
    let deliveryAddress: string | null = null;
    if (booking.metadata) {
      try {
        const parsed = JSON.parse(booking.metadata);
        if (parsed?.deliveryMethod) {
          const method = String(parsed.deliveryMethod);
          if (['pickup', 'delivery', 'shipping'].includes(method)) {
            deliveryMethod = method as typeof deliveryMethod;
          }
        }
        if (parsed?.deliveryAddress) {
          deliveryAddress = String(parsed.deliveryAddress);
        }
      } catch {
        // Ignore metadata parsing errors
      }
    }

    const listing = booking.listing
      ? {
          ...booking.listing,
          images: booking.listing.photos || booking.listing.images || [],
          pricePerDay: toNumber(booking.listing.basePrice) || pricePerDay,
        }
      : undefined;

    const renter = booking.renter
      ? {
          ...booking.renter,
          avatar: booking.renter.profilePhotoUrl || null,
          rating: booking.renter.averageRating ?? null,
        }
      : undefined;

    const owner = booking.listing?.owner
      ? {
          ...booking.listing.owner,
          avatar: booking.listing.owner.profilePhotoUrl || null,
          rating: booking.listing.owner.averageRating ?? null,
        }
      : booking.owner;

    const review =
      userId && Array.isArray(booking.reviews)
        ? booking.reviews.find((item: any) => item.reviewerId === userId)
        : undefined;

    return {
      ...booking,
      ownerId: booking.ownerId || booking.listing?.ownerId,
      listing,
      renter,
      owner,
      review: review
        ? {
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
          }
        : undefined,
      paymentStatus,
      totalDays,
      pricePerDay,
      subtotal,
      serviceFee,
      deliveryFee: 0,
      securityDeposit,
      totalAmount,
      deliveryMethod,
      deliveryAddress,
      pricing: {
        subtotal,
        serviceFee,
        deliveryFee: 0,
        securityDeposit,
        totalAmount,
      },
    };
  }

  async approveBooking(bookingId: string, ownerId: string): Promise<Booking> {
    const booking = (await this.findById(bookingId)) as any;

    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized to approve this booking');
    }

    await this.stateMachine.transition(bookingId, 'OWNER_APPROVE', ownerId, 'OWNER');

    return this.findById(bookingId);
  }

  async rejectBooking(bookingId: string, ownerId: string, reason?: string): Promise<Booking> {
    const booking = (await this.findById(bookingId)) as any;

    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized to reject this booking');
    }

    await this.stateMachine.transition(bookingId, 'OWNER_REJECT', ownerId, 'OWNER', { reason });

    return this.findById(bookingId);
  }

  async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<Booking> {
    const booking = (await this.findById(bookingId)) as any;

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to cancel this booking');
    }

    // Calculate refund
    const refund = await this.calculation.calculateRefund(bookingId, new Date());

    // Process refund if applicable
    if (refund.refundAmount > 0 && booking.paymentIntentId) {
      // Import StripeService via constructor if needed
      // For now, publish event to payment service to handle refund
      await this.cacheService.publish('booking:cancelled', {
        bookingId,
        paymentIntentId: booking.paymentIntentId,
        refundAmount: refund.refundAmount,
        reason: refund.reason,
      });
    }

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
    const booking = (await this.findById(bookingId)) as any;

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
    const booking = (await this.findById(bookingId)) as any;

    if (booking.renterId !== renterId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.stateMachine.transition(bookingId, 'REQUEST_RETURN', renterId, 'RENTER');

    return this.findById(bookingId);
  }

  async approveReturn(bookingId: string, ownerId: string): Promise<Booking> {
    const booking = (await this.findById(bookingId)) as any;

    if (booking.listing.ownerId !== ownerId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.stateMachine.transition(bookingId, 'APPROVE_RETURN', ownerId, 'OWNER');

    return this.findById(bookingId);
  }

  async initiateDispute(bookingId: string, userId: string, reason: string): Promise<Booking> {
    const booking = (await this.findById(bookingId)) as any;

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
    const booking = (await this.findById(bookingId)) as any;
    const history = await this.stateMachine.getStateHistory(bookingId);

    return {
      booking,
      stateHistory: history,
      timeline: this.generateTimeline(booking, history),
    };
  }

  private generateTimeline(booking: Booking, history: any[]) {
    return history.map((h) => {
      let metadata = null;
      if (h.metadata) {
        try {
          metadata = JSON.parse(h.metadata);
        } catch {
          metadata = h.metadata;
        }
      }

      return {
        fromStatus: h.fromStatus || null,
        toStatus: h.toStatus,
        timestamp: h.createdAt,
        actor: h.changedBy || null,
        metadata,
      };
    });
  }

  async getBlockedDates(listingId: string): Promise<string[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.IN_PROGRESS,
            BookingStatus.AWAITING_RETURN_INSPECTION,
          ],
        },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    const blockedDates: string[] = [];
    bookings.forEach((booking) => {
      let current = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      while (current <= end) {
        blockedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    // Also include manually blocked dates from availability table
    const manuallyBlocked = await this.prisma.availability.findMany({
      where: {
        propertyId: listingId,
        status: 'blocked',
      },
    });

    manuallyBlocked.forEach((rule) => {
      let current = new Date(rule.startDate);
      const end = new Date(rule.endDate);
      while (current <= end) {
        blockedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    return [...new Set(blockedDates)];
  }
}
