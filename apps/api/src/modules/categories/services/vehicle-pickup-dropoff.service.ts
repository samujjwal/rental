import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CacheService } from '@/common/cache/cache.service';

/**
 * Vehicle Pickup/Drop-off Service
 * 
 * Handles vehicle-specific pickup and drop-off logic including:
 * - Mileage tracking
 * - Fuel level validation
 * - Vehicle condition documentation
 * - Key handover tracking
 * - Location verification
 */
@Injectable()
export class VehiclePickupDropoffService {
  private readonly logger = new Logger(VehiclePickupDropoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Record vehicle pickup with mileage and condition
   */
  async recordPickup(bookingId: string, data: {
    mileage: number;
    fuelLevel: number; // 0-100 percentage
    photos: string[];
    notes?: string;
    pickupLocation?: string;
    signature?: string;
  }) {
    // Validate booking exists and is in correct state
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        listing: {
          include: { category: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Validate vehicle category
    const categorySlug = booking.listing.category?.slug || 'vehicles';
    if (categorySlug !== 'vehicles') {
      throw new BadRequestException('This service is only for vehicle bookings');
    }

    // Validate mileage
    if (data.mileage < 0 || data.mileage > 1000000) {
      throw new BadRequestException('Invalid mileage value');
    }

    // Validate fuel level
    if (data.fuelLevel < 0 || data.fuelLevel > 100) {
      throw new BadRequestException('Fuel level must be between 0 and 100');
    }

    // Create or update condition report
    const conditionReport = await this.prisma.conditionReport.create({
      data: {
        bookingId,
        propertyId: booking.listingId,
        createdBy: booking.renterId,
        checkIn: true,
        checkOut: false,
        photos: data.photos,
        notes: data.notes,
        signature: data.signature,
        status: 'PICKUP_COMPLETED',
        reportType: 'VEHICLE_PICKUP',
        checklistData: JSON.stringify({
          mileage: data.mileage,
          fuelLevel: data.fuelLevel,
          pickupLocation: data.pickupLocation,
          pickupTime: new Date().toISOString(),
        }),
      },
    });

    this.logger.log(`Vehicle pickup recorded for booking ${bookingId}`);
    
    return conditionReport;
  }

  /**
   * Record vehicle drop-off with mileage and condition
   */
  async recordDropoff(bookingId: string, data: {
    mileage: number;
    fuelLevel: number;
    photos: string[];
    notes?: string;
    dropoffLocation?: string;
    signature?: string;
    damages?: string;
  }) {
    // Validate booking exists
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        listing: {
          include: { category: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Validate vehicle category
    const categorySlug = booking.listing.category?.slug || 'vehicles';
    if (categorySlug !== 'vehicles') {
      throw new BadRequestException('This service is only for vehicle bookings');
    }

    // Get pickup report to calculate mileage difference
    const pickupReport = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId,
        checkIn: true,
        reportType: 'VEHICLE_PICKUP',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pickupReport) {
      throw new BadRequestException('Pickup report not found. Cannot complete drop-off without pickup record.');
    }

    const pickupData = JSON.parse(pickupReport.checklistData || '{}');
    const mileageUsed = data.mileage - pickupData.mileage;

    // Validate mileage (should not decrease)
    if (data.mileage < pickupData.mileage) {
      throw new BadRequestException('Drop-off mileage cannot be less than pickup mileage');
    }

    // Validate fuel level
    if (data.fuelLevel < 0 || data.fuelLevel > 100) {
      throw new BadRequestException('Fuel level must be between 0 and 100');
    }

    // Create drop-off condition report
    const conditionReport = await this.prisma.conditionReport.create({
      data: {
        bookingId,
        propertyId: booking.listingId,
        createdBy: booking.renterId,
        checkIn: false,
        checkOut: true,
        photos: data.photos,
        notes: data.notes,
        damages: data.damages,
        signature: data.signature,
        status: 'DROPOFF_COMPLETED',
        reportType: 'VEHICLE_DROPOFF',
        checklistData: JSON.stringify({
          mileage: data.mileage,
          fuelLevel: data.fuelLevel,
          mileageUsed,
          pickupMileage: pickupData.mileage,
          fuelDifference: data.fuelLevel - pickupData.fuelLevel,
          dropoffLocation: data.dropoffLocation,
          dropoffTime: new Date().toISOString(),
        }),
      },
    });

    // Calculate potential charges for excess mileage or fuel
    const charges = await this.calculateAdditionalCharges(
      bookingId,
      mileageUsed,
      data.fuelLevel,
      pickupData.fuelLevel,
    );

    this.logger.log(`Vehicle drop-off recorded for booking ${bookingId}, mileage used: ${mileageUsed}`);
    
    return {
      conditionReport,
      charges,
    };
  }

  /**
   * Calculate additional charges for excess mileage or fuel
   */
  private async calculateAdditionalCharges(
    bookingId: string,
    mileageUsed: number,
    returnFuelLevel: number,
    pickupFuelLevel: number,
  ) {
    const charges = {
      excessMileageCharge: 0,
      fuelCharge: 0,
      totalAdditionalCharge: 0,
      currency: 'USD',
    };

    // Get booking details to check mileage allowance
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      return charges;
    }

    // Get category attributes for mileage allowance
    const mileageAllowance = 200; // Default 200 miles per day
    const mileageRate = 0.50; // $0.50 per excess mile
    const fuelRate = 5.00; // $5.00 per 10% fuel difference

    // Calculate excess mileage (simplified - would need duration calculation)
    const bookingDays = Math.ceil(
      (new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    const allowedMileage = mileageAllowance * Math.max(bookingDays, 1);
    
    if (mileageUsed > allowedMileage) {
      const excessMiles = mileageUsed - allowedMileage;
      charges.excessMileageCharge = Math.round(excessMiles * mileageRate * 100) / 100;
    }

    // Calculate fuel charge if returned with less fuel
    if (returnFuelLevel < pickupFuelLevel) {
      const fuelDifference = pickupFuelLevel - returnFuelLevel;
      const fuelUnits = Math.ceil(fuelDifference / 10);
      charges.fuelCharge = fuelUnits * fuelRate;
    }

    charges.totalAdditionalCharge = charges.excessMileageCharge + charges.fuelCharge;
    charges.currency = booking.currency;

    return charges;
  }

  /**
   * Get vehicle pickup/drop-off history for a booking
   */
  async getVehicleHistory(bookingId: string) {
    const reports = await this.prisma.conditionReport.findMany({
      where: {
        bookingId,
        reportType: { in: ['VEHICLE_PICKUP', 'VEHICLE_DROPOFF'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return reports.map(report => ({
      ...report,
      checklistData: JSON.parse(report.checklistData || '{}'),
    }));
  }

  /**
   * Validate vehicle condition before pickup
   */
  async validatePickupCondition(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if pickup already recorded
    const existingPickup = await this.prisma.conditionReport.findFirst({
      where: {
        bookingId,
        checkIn: true,
        reportType: 'VEHICLE_PICKUP',
      },
    });

    if (existingPickup) {
      throw new BadRequestException('Pickup already recorded');
    }

    // Validate booking is in correct state for pickup
    const validStates = ['CONFIRMED', 'IN_PROGRESS'];
    if (!validStates.includes(booking.status)) {
      throw new BadRequestException(`Booking must be in ${validStates.join(' or ')} state for pickup`);
    }

    return {
      valid: true,
      message: 'Vehicle ready for pickup',
    };
  }
}
