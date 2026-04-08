import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { i18nBadRequest, i18nNotFound, i18nForbidden } from '@/common/errors/i18n-exceptions';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';
import { Booking, BookingStatus, BookingMode, toNumber } from '@rental-portal/database';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

// Type for booking with included relations from findById()
type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    payments: { select: { status: true } };
    reviews: {
      select: { id: true; rating: true; comment: true; createdAt: true; reviewerId: true };
    };
    renter: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        profilePhotoUrl: true;
        averageRating: true;
        totalReviews: true;
      };
    };
    listing: {
      include: {
        owner: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            profilePhotoUrl: true;
            averageRating: true;
          };
        };
        category: true;
      };
    };
  };
}>;
import { Inject } from '@nestjs/common';
import { AvailabilityService } from '@/modules/listings/services/availability.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingValidationService } from './booking-validation.service';
import { PolicyEngineService } from '@/modules/policy-engine/services/policy-engine.service';
import { ContextResolverService } from '@/modules/policy-engine/services/context-resolver.service';
import {
  BOOKING_ELIGIBILITY_PORT,
  type BookingEligibilityPort,
} from '../ports/booking-eligibility.port';
import { BOOKING_PRICING_PORT, type BookingPricingPort } from '../ports/booking-pricing.port';

export interface CreateBookingDto {
  listingId: string;
  startDate: Date | string;
  endDate: Date | string;
  guestCount?: number;
  message?: string;
  promoCode?: string;
  specialRequests?: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
}

export interface UpdateBookingDto {
  startDate?: Date | string;
  endDate?: Date | string;
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
    private readonly bookingValidator: BookingValidationService,
    @Inject(BOOKING_ELIGIBILITY_PORT)
    private readonly eligibilityChecks: BookingEligibilityPort,
    private readonly policyEngine: PolicyEngineService,
    private readonly contextResolver: ContextResolverService,
    @Inject(BOOKING_PRICING_PORT)
    private readonly pricing: BookingPricingPort,
    private readonly configService: ConfigService,
  ) {}

  async create(renterId: string, dto: CreateBookingDto): Promise<Booking> {
    // Strict date validation with timezone awareness
    const startDate = this.validateAndParseDate(dto.startDate, 'startDate');
    const endDate = this.validateAndParseDate(dto.endDate, 'endDate');

    // Validate date range logic
    if (endDate <= startDate) {
      throw i18nBadRequest('booking.invalidDates');
    }

    // Validate dates are not in the past
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (startDate < now) {
      throw i18nBadRequest('booking.invalidDates');
    }

    // Validate booking is not too far in the future (default 1 year)
    const maxBookingDate = new Date();
    maxBookingDate.setFullYear(maxBookingDate.getFullYear() + 1);
    if (endDate > maxBookingDate) {
      throw i18nBadRequest('booking.invalidDates');
    }

    // Delegate date, listing, and blocked-period validation to BookingValidationService
    const dateValidation = this.bookingValidator.validateDates(startDate, endDate);
    if (!dateValidation.isValid) {
      throw new BadRequestException({
        message: dateValidation.errors?.join('; ') || 'Invalid booking dates',
        errors: dateValidation.errors,
      });
    }
    const listing = await this.bookingValidator.validateListing(
      dto.listingId,
      renterId,
      dto.guestCount,
    );
    try {
      await this.bookingValidator.checkBlockedPeriods(dto.listingId, startDate, endDate);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn('Availability table check failed, relying on booking conflict check', err);
    }

    // Track which safety checks were skipped due to service failures
    const safetyChecksSkipped: string[] = [];

    // Calculate pricing first; totalPrice is needed by the fraud risk scorer.
    const pricing = await this.pricing.quote(dto.listingId, startDate, endDate);

    // Run all safety checks (compliance, insurance, moderation, fraud) through
    // the eligibility port. This keeps safety orchestration out of BookingsService.
    const eligibility = await this.eligibilityChecks.evaluate({
      renterId,
      listingId: dto.listingId,
      message: dto.message,
      totalPrice: pricing.total,
      startDate,
      endDate,
      listing: {
        country: listing.country,
        state: listing.state,
        city: listing.city,
        currency: listing.currency,
      },
    });

    if (!eligibility.allowed) {
      throw new BadRequestException({
        message: eligibility.rejection!.reason,
        ...eligibility.rejection!.details,
      });
    }

    safetyChecksSkipped.push(...eligibility.skippedChecks);

    // Calculate tax via PolicyEngine (jurisdiction-aware)
    let listingAddress: Record<string, string> | null = null;
    if (typeof listing.address === 'string') {
      try {
        listingAddress = JSON.parse(listing.address);
      } catch {
        listingAddress = null;
      }
    } else {
      listingAddress = listing.address as Record<string, string> | null;
    }
    const policyContext = this.contextResolver.resolve({
      listingCountry:
        (listingAddress as Record<string, string> | null)?.country || listing.country || undefined,
      listingState: listing.state || undefined,
      listingCity: listing.city || undefined,
      currency: listing.currency,
      bookingValue: pricing.subtotal,
      userId: renterId,
    });
    let taxBreakdown: { totalTax: number; total: number } = {
      totalTax: 0,
      total: pricing.total,
    };
    let taxCalculationFailed = false;
    try {
      taxBreakdown = await this.policyEngine.calculateTax(
        policyContext,
        pricing.subtotal,
        'booking',
      );
    } catch (err) {
      this.logger.error('Tax calculation failed — booking will be flagged for manual review', err);
      taxCalculationFailed = true;
    }

    // Evaluate booking constraints via PolicyEngine (min/max stay, age, documents, blocks)
    let constraintEvaluationFailed = false;
    try {
      const constraintDecision = await this.policyEngine.evaluateBookingConstraints(
        policyContext,
        'Listing',
        dto.listingId,
      );

      if (!constraintDecision.isAllowed) {
        const reasons = constraintDecision.blockedReasons.map((r) => r.reason).join('; ');
        throw new BadRequestException({
          message: `Booking not allowed: ${reasons}`,
          blockedReasons: constraintDecision.blockedReasons,
        });
      }

      // Validate min/max stay against booking duration
      const durationDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (constraintDecision.minStay !== null && durationDays < constraintDecision.minStay) {
        throw new BadRequestException({
          message: `Minimum stay is ${constraintDecision.minStay} days, but booking is ${durationDays} days`,
          minStay: constraintDecision.minStay,
          requestedDays: durationDays,
        });
      }

      if (constraintDecision.maxStay !== null && durationDays > constraintDecision.maxStay) {
        throw new BadRequestException({
          message: `Maximum stay is ${constraintDecision.maxStay} days, but booking is ${durationDays} days`,
          maxStay: constraintDecision.maxStay,
          requestedDays: durationDays,
        });
      }

      // Store required documents for downstream validation
      if (constraintDecision.requiredDocuments.length > 0) {
        this.logger.log(
          `Booking for listing ${dto.listingId} requires documents: ${constraintDecision.requiredDocuments.map((d) => d.documentType).join(', ')}`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn('Booking constraint evaluation failed — flagged for manual review', err);
      constraintEvaluationFailed = true;
    }

    // Determine initial status based on booking mode
    let initialStatus: BookingStatus;
    // Corrected Enum usage matching Prisma Schema
    if (listing.bookingMode === BookingMode.INSTANT_BOOK) {
      initialStatus = BookingStatus.PENDING_PAYMENT;
    } else {
      initialStatus = BookingStatus.PENDING_OWNER_APPROVAL;
    }

    // Create booking within transaction to prevent race conditions
    const booking = (await this.prisma.$transaction(async (tx: any) => {
      // Acquire PostgreSQL advisory lock on listing ID to serialize booking attempts.
      // Hash the ID to produce stable 32-bit lock keys regardless of ID format (UUID or CUID).
      const idHash = createHash('sha256').update(dto.listingId).digest();
      const lockKeyHi = idHash.readInt32BE(0);
      const lockKeyLo = idHash.readInt32BE(4);
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1, $2)`, lockKeyHi, lockKeyLo);

      // Check for conflicting bookings within the transaction
      const conflicts = await tx.booking.findMany({
        where: {
          listingId: dto.listingId,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
          },
          OR: [
            {
              AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }],
            },
            {
              AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }],
            },
            {
              AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }],
            },
          ],
        },
      });

      if (conflicts.length > 0) {
        throw new BadRequestException({
          message: 'Listing not available for selected dates',
          conflicts: conflicts.map((c: any) => ({
            startDate: c.startDate,
            endDate: c.endDate,
            bookingId: c.id,
          })),
        });
      }

      // Create booking atomically
      const bookingMetadata: Record<string, any> = {};
      if (dto.deliveryMethod) {
        bookingMetadata.deliveryMethod = dto.deliveryMethod;
      }
      if (dto.deliveryAddress) {
        bookingMetadata.deliveryAddress = dto.deliveryAddress;
      }
      if (taxCalculationFailed) {
        bookingMetadata.taxCalculationFailed = true;
        bookingMetadata.needsManualTaxReview = true;
      }
      if (constraintEvaluationFailed) {
        bookingMetadata.constraintEvaluationFailed = true;
        bookingMetadata.needsManualConstraintReview = true;
      }
      if (safetyChecksSkipped.length > 0) {
        bookingMetadata.safetyChecksSkipped = safetyChecksSkipped;
        bookingMetadata.needsReview = true;
      }

      const createdBooking = await tx.booking.create({
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
          totalPrice: pricing.total + taxBreakdown.totalTax,
          taxAmount: taxBreakdown.totalTax,
          platformFee: pricing.platformFee,
          serviceFee: pricing.serviceFee,
          depositAmount: pricing.depositAmount,
          ownerEarnings: pricing.ownerEarnings,
          currency: listing.currency,
          stateHistory: {
            create: {
              toStatus: initialStatus,
              changedBy: renterId,
              reason: 'Booking created',
            },
          },
        } as Prisma.BookingUncheckedCreateInput,
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

      // Persist price breakdown line items for the booking (inside transaction)
      const days = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      
      try {
        await this.pricing.persistBreakdown(createdBooking.id, {
          basePrice: pricing.breakdown.basePrice,
          nights: days,
          securityDeposit: pricing.depositAmount,
          taxRate: taxBreakdown.totalTax > 0 ? taxBreakdown.totalTax / pricing.subtotal : undefined,
          currency: listing.currency,
        });
      } catch (err) {
        // Log but don't fail the booking - price breakdown is non-critical
        this.logger.warn(`Failed to persist price breakdown for booking ${createdBooking.id}`, err);
      }

      return createdBooking;
    })) as unknown as Booking;

    // Capture FX rate snapshot when listing currency differs from platform default
    const platformDefaults = this.contextResolver.resolve({});
    const platformCurrency = platformDefaults.currency || 'USD';
    if (listing.currency && listing.currency !== platformCurrency) {
      try {
        await this.pricing.captureExchangeRate(booking.id, platformCurrency, listing.currency);
      } catch (err) {
        this.logger.warn(`Failed to capture FX rate for booking ${booking.id}`, err);
      }
    }

    // Send notification to owner (non-critical — don't fail the booking)
    try {
      await this.cacheService.publish('booking:created', {
        bookingId: booking.id,
        renterId,
        ownerId: listing.ownerId,
        listingId: dto.listingId,
        status: initialStatus,
      });
    } catch (err) {
      this.logger.warn(`Failed to publish booking:created event for ${booking.id}`, err);
    }

    return this.attachPaymentStatus(booking);
  }

  async findById(
    id: string,
    includePrivate: boolean = false,
    userId?: string,
  ): Promise<BookingWithRelations> {
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
      throw i18nNotFound('booking.notFound');
    }

    // Authorization check if userId is provided
    if (userId) {
      const isRenter = booking.renterId === userId;
      const isOwner = booking.listing?.ownerId === userId;

      if (!isRenter && !isOwner) {
        // Check if user is admin (using centralized admin roles from config)
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        const adminRoles = this.configService.get<string[]>('security.adminRoles', [
          'ADMIN', 'SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'
        ]);
        if (!user?.role || !adminRoles.includes(user.role)) {
          throw i18nForbidden('booking.unauthorizedAction');
        }
      }
    }

    return this.attachPaymentStatus(booking, userId);
  }

  async getRenterBookings(
    renterId: string,
    status?: BookingStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Booking[]; total: number; page: number; limit: number }> {
    const where: any = { renterId };
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
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
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings.map((booking) => this.attachPaymentStatus(booking)),
      total,
      page,
      limit,
    };
  }

  async getOwnerBookings(
    ownerId: string,
    status?: BookingStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: Booking[]; total: number; page: number; limit: number }> {
    const where: any = {
      listing: { ownerId },
    };
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
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
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings.map((booking) => this.attachPaymentStatus(booking)),
      total,
      page,
      limit,
    };
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
        ['CONFIRMED', 'IN_PROGRESS', 'AWAITING_RETURN_INSPECTION', 'COMPLETED', 'SETTLED'].includes(
          bookingStatus,
        )
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
    const totalAmount = toNumber(booking.totalPrice) || 0;
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
      } catch (error) {
        this.logger.debug(
          `Metadata parsing failed for booking: ${error instanceof Error ? error.message : error}`,
        );
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
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    await this.stateMachine.transition(bookingId, 'OWNER_APPROVE', ownerId, 'OWNER');

    return this.findById(bookingId);
  }

  async rejectBooking(bookingId: string, ownerId: string, reason?: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    await this.stateMachine.transition(bookingId, 'OWNER_REJECT', ownerId, 'OWNER', { reason });

    return this.findById(bookingId);
  }

  async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    // Calculate refund
    const refund = await this.pricing.calculateRefund(bookingId, new Date());

    // State machine transition handles refund process via triggerRefundProcess()
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

    const isOwner = booking.listing.ownerId === userId;

    if (!isOwner) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    await this.stateMachine.transition(bookingId, 'START_RENTAL', userId, 'OWNER');

    return this.findById(bookingId);
  }

  async requestReturn(bookingId: string, renterId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== renterId) {
      throw i18nForbidden('common.notAuthorized');
    }

    await this.stateMachine.transition(bookingId, 'REQUEST_RETURN', renterId, 'RENTER');

    return this.findById(bookingId);
  }

  async approveReturn(bookingId: string, ownerId: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw i18nForbidden('common.notAuthorized');
    }

    await this.stateMachine.transition(bookingId, 'APPROVE_RETURN', ownerId, 'OWNER');

    return this.findById(bookingId);
  }

  async rejectReturn(bookingId: string, ownerId: string, reason: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.listing.ownerId !== ownerId) {
      throw i18nForbidden('common.notAuthorized');
    }

    await this.stateMachine.transition(bookingId, 'REJECT_RETURN', ownerId, 'OWNER', { reason });

    return this.findById(bookingId);
  }

  async initiateDispute(bookingId: string, userId: string, reason: string): Promise<Booking> {
    const booking = await this.findById(bookingId);

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw i18nForbidden('common.notAuthorized');
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

  async getBookingStats(bookingId: string, userId?: string) {
    const booking = await this.findById(bookingId, true, userId);
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

  async getBlockedDates(listingId: string, maxDays: number = 365): Promise<string[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        listingId,
        status: {
          in: [
            BookingStatus.PENDING_OWNER_APPROVAL,
            BookingStatus.CONFIRMED,
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.IN_PROGRESS,
            BookingStatus.AWAITING_RETURN_INSPECTION,
          ],
        },
        // Only look at bookings ending in the future or recent past
        endDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    const blockedDates: string[] = [];
    bookings.forEach((booking) => {
      const current = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      let dayCount = 0;
      while (current <= end && dayCount < maxDays) {
        blockedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
        dayCount++;
      }
    });

    // Also include manually blocked dates from availability table
    const manuallyBlocked = await this.prisma.availability.findMany({
      where: {
        propertyId: listingId,
        status: 'BLOCKED',
      },
    });

    manuallyBlocked.forEach((rule) => {
      const current = new Date(rule.startDate);
      const end = new Date(rule.endDate);
      while (current <= end) {
        blockedDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    return [...new Set(blockedDates)];
  }

  /**
   * Get disputes for a booking (verifies access first)
   */
  async getBookingDisputes(bookingId: string, userId: string) {
    // Verify user has access to this booking
    await this.findById(bookingId, false, userId);
    return this.prisma.dispute.findMany({
      where: { bookingId },
      include: {
        initiator: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all condition reports for a booking.
   * User must be the renter, owner, or an admin.
   */
  async getConditionReports(bookingId: string, userId: string) {
    await this.findById(bookingId, false, userId);
    return this.prisma.conditionReport.findMany({
      where: { bookingId },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update a specific condition report — add photos, notes, damages, or sign off.
   *
   * Access rules:
   *  - Report creator may always update.
   *  - Owner may update a CHECK_OUT report (return inspection).
   *  - Admin may update any report.
   */
  async updateConditionReport(
    bookingId: string,
    reportId: string,
    userId: string,
    dto: {
      notes?: string;
      damages?: string;
      signature?: string;
      photos?: string[];
      checklistData?: string;
    },
  ) {
    const booking = await this.findById(bookingId, false, userId);

    const report = await this.prisma.conditionReport.findFirst({
      where: { id: reportId, bookingId },
    });
    if (!report) {
      throw i18nNotFound('booking.notFound');
    }

    const isRenter = booking.renterId === userId;
    const isOwner = booking.listing?.ownerId === userId;
    const isAdmin = !isRenter && !isOwner;

    const isCreator = report.createdBy === userId;
    const ownerInspecting = isOwner && report.reportType === 'CHECK_OUT';

    if (!isAdmin && !isCreator && !ownerInspecting) {
      throw i18nForbidden('booking.unauthorizedAction');
    }

    return this.prisma.conditionReport.update({
      where: { id: reportId },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.damages !== undefined && { damages: dto.damages }),
        ...(dto.signature !== undefined && { signature: dto.signature }),
        ...(dto.checklistData !== undefined && { checklistData: dto.checklistData }),
        ...(dto.photos !== undefined && { photos: dto.photos }),
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
    });
  }

  /**
   * Validates and parses a date string or Date object.
   * Throws an error if the date is invalid or cannot be parsed.
   */
  private validateAndParseDate(dateInput: Date | string, fieldName: string): Date {
    let parsedDate: Date;

    if (dateInput instanceof Date) {
      parsedDate = dateInput;
    } else if (typeof dateInput === 'string') {
      // Try to parse the date string
      parsedDate = new Date(dateInput);
    } else {
      throw i18nBadRequest('booking.invalidDates');
    }

    // Check if the date is valid (not Invalid Date)
    if (isNaN(parsedDate.getTime())) {
      throw i18nBadRequest('booking.invalidDates');
    }

    // Normalize to midnight UTC to avoid timezone issues
    const normalizedDate = new Date(Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    ));

    return normalizedDate;
  }
}
