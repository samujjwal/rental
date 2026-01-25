import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '@/common/email/email.service';
import { ConditionReport, FulfillmentStatus, BookingStatus } from '@rental-portal/database';

export interface CreateConditionReportDto {
  bookingId: string;
  type: 'PICKUP' | 'RETURN';
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  photos: string[];
  notes?: string;
  damages?: Array<{
    description: string;
    severity: 'MINOR' | 'MODERATE' | 'SEVERE';
    photos: string[];
  }>;
}

export interface UpdateFulfillmentDto {
  status: FulfillmentStatus;
  notes?: string;
  completedAt?: Date;
}

@Injectable()
export class FulfillmentService {
  constructor(
    private prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create condition report
   */
  async createConditionReport(
    userId: string,
    dto: CreateConditionReportDto,
  ): Promise<ConditionReport> {
    const { bookingId, type, condition, photos, notes, damages = [] } = dto;

    // Get booking with relations
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: true,
        fulfillment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify authorization (owner or renter can create reports)
    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to create condition report');
    }

    // Validate booking status
    if (type === 'PICKUP' && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Booking must be confirmed for pickup report');
    }

    if (type === 'RETURN' && booking.status !== BookingStatus.ACTIVE) {
      throw new BadRequestException('Booking must be active for return report');
    }

    // Check if report already exists for this type
    const existingReport = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId,
        type,
      },
    });

    if (existingReport) {
      throw new BadRequestException(`${type.toLowerCase()} condition report already exists`);
    }

    // Create condition report
    const report = await this.prisma.conditionReport.create({
      data: {
        bookingId,
        reportedBy: userId,
        type,
        condition,
        photos,
        notes,
        damages,
      },
    });

    // Update fulfillment status based on report type
    if (booking.fulfillment) {
      if (type === 'PICKUP') {
        await this.prisma.fulfillment.update({
          where: { id: booking.fulfillment.id },
          data: {
            pickupCompletedAt: new Date(),
            status:
              booking.fulfillment.returnCompletedAt !== null
                ? FulfillmentStatus.COMPLETED
                : FulfillmentStatus.PICKED_UP,
          },
        });

        // Update booking status to ACTIVE after pickup
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.ACTIVE },
        });
      } else if (type === 'RETURN') {
        await this.prisma.fulfillment.update({
          where: { id: booking.fulfillment.id },
          data: {
            returnCompletedAt: new Date(),
            status: FulfillmentStatus.COMPLETED,
          },
        });

        // Update booking status to COMPLETED after return
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }
    }

    // If damages reported, create notification
    if (damages.length > 0) {
      // TODO: Send notification to owner about damages
    }

    return report;
  }

  /**
   * Get condition reports for booking
   */
  async getBookingReports(bookingId: string, userId: string): Promise<ConditionReport[]> {
    // Verify authorization
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to view condition reports');
    }

    return this.prisma.conditionReport.findMany({
      where: { bookingId },
      include: {
        reportedByUser: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get condition report by ID
   */
  async getReport(reportId: string, userId: string): Promise<ConditionReport> {
    const report = await this.prisma.conditionReport.findUnique({
      where: { id: reportId },
      include: {
        booking: {
          include: {
            listing: true,
          },
        },
        reportedByUser: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Condition report not found');
    }

    // Verify authorization
    if (report.booking.renterId !== userId && report.booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to view this report');
    }

    return report;
  }

  /**
   * Update condition report (within 24 hours of creation)
   */
  async updateReport(
    reportId: string,
    userId: string,
    updates: Partial<CreateConditionReportDto>,
  ): Promise<ConditionReport> {
    const report = await this.prisma.conditionReport.findUnique({
      where: { id: reportId },
      include: {
        booking: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Condition report not found');
    }

    // Only creator can update
    if (report.reportedBy !== userId) {
      throw new ForbiddenException('Can only update your own reports');
    }

    // Check if within 24 hours
    const hoursSinceCreation = (Date.now() - report.createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceCreation > 24) {
      throw new BadRequestException('Can only update report within 24 hours');
    }

    return this.prisma.conditionReport.update({
      where: { id: reportId },
      data: {
        condition: updates.condition,
        photos: updates.photos,
        notes: updates.notes,
        damages: updates.damages,
      },
    });
  }

  /**
   * Initialize fulfillment for booking
   */
  async initializeFulfillment(
    bookingId: string,
    data: {
      pickupMethod: 'PICKUP' | 'DELIVERY';
      returnMethod: 'PICKUP' | 'DELIVERY';
      pickupAddress?: string;
      returnAddress?: string;
      pickupScheduledAt?: Date;
      returnScheduledAt?: Date;
    },
  ): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { fulfillment: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.fulfillment) {
      return booking.fulfillment;
    }

    return this.prisma.fulfillment.create({
      data: {
        bookingId,
        pickupMethod: data.pickupMethod,
        returnMethod: data.returnMethod,
        pickupAddress: data.pickupAddress,
        returnAddress: data.returnAddress,
        pickupScheduledAt: data.pickupScheduledAt,
        returnScheduledAt: data.returnScheduledAt,
        status: FulfillmentStatus.PENDING,
      },
    });
  }

  /**
   * Update fulfillment status
   */
  async updateFulfillmentStatus(
    fulfillmentId: string,
    userId: string,
    dto: UpdateFulfillmentDto,
  ): Promise<any> {
    const fulfillment = await this.prisma.fulfillment.findUnique({
      where: { id: fulfillmentId },
      include: {
        booking: {
          include: {
            listing: true,
          },
        },
      },
    });

    if (!fulfillment) {
      throw new NotFoundException('Fulfillment not found');
    }

    // Verify authorization (owner only)
    if (fulfillment.booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Only owner can update fulfillment status');
    }

    const updateData: any = {
      status: dto.status,
      notes: dto.notes,
    };

    // Update completion timestamps based on status
    if (dto.status === FulfillmentStatus.PICKED_UP && !fulfillment.pickupCompletedAt) {
      updateData.pickupCompletedAt = new Date();
    }

    if (dto.status === FulfillmentStatus.COMPLETED && !fulfillment.returnCompletedAt) {
      updateData.returnCompletedAt = new Date();
    }

    return this.prisma.fulfillment.update({
      where: { id: fulfillmentId },
      data: updateData,
    });
  }

  /**
   * Get fulfillment details
   */
  async getFulfillment(bookingId: string, userId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        listing: true,
        fulfillment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify authorization
    if (booking.renterId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Not authorized to view fulfillment');
    }

    return booking.fulfillment;
  }

  /**
   * Record damage claim
   */
  async recordDamageClaim(
    bookingId: string,
    userId: string,
    claim: {
      description: string;
      estimatedCost: number;
      photos: string[];
      reportId?: string;
    },
  ): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Only owner can file damage claims
    if (booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Only owner can file damage claims');
    }

    // Create damage claim (stored as JSON in fulfillment record)
    const fulfillment = await this.prisma.fulfillment.findFirst({
      where: { bookingId },
    });

    if (!fulfillment) {
      throw new NotFoundException('Fulfillment not found');
    }

    const damageClaim = {
      ...claim,
      claimedAt: new Date(),
      claimedBy: userId,
      status: 'PENDING',
    };

    await this.prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        damageClaim,
      },
    });

    // Notify renter about damage claim
    if (booking.renter) {
      await this.emailService.sendEmail(
        booking.renter.email,
        'Damage Claim Filed',
        `<p>A damage claim has been filed for your booking of <strong>${booking.listing.title}</strong>.</p><p>Description: ${claim.description}</p><p>Estimated Cost: ${claim.estimatedCost}</p>`,
      );
    }

    return fulfillment;

    // Notify renter about damage claim
    if (booking.renter) {
      await this.emailService.sendEmail(
        booking.renter.email,
        'Damage Claim Filed',
        `<p>A damage claim has been filed for your booking of <strong>${booking.listing.title}</strong>.</p><p>Description: ${claim.description}</p><p>Estimated Cost: $${claim.estimatedCost}</p>`,
      );
    }

    return fulfillment;
  }
}
