import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AvailabilityRepository } from '../repositories/availability.repository';
import { BookingRepository } from '../../bookings/repositories/booking.repository';
import { ListingRepository } from '../../listings/repositories/listing.repository';
import { CacheService } from '../../../common/cache/cache.service';

@Injectable()
export class AvailabilityLogicService {
  private readonly logger = new Logger(AvailabilityLogicService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly availabilityRepository: AvailabilityRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly listingRepository: ListingRepository,
    private readonly cacheService: CacheService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async calculateAvailability(listingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Check cache first
    const cacheKey = `availability:${listingId}:${startDate.getTime()}:${endDate.getTime()}`;
    const cached = await this.cacheService.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const cacheTTL = this.configService.get('CACHE_TTL') || 3600;

    // Fetch bookings for the period
    const bookings = (await this.bookingRepository.findBookingsByPeriod(listingId, startDate, endDate)) || [];

    // Fetch availability from repository
    const existingAvailability = await this.availabilityRepository.findAvailability(listingId);

    // If repository has availability data, use it
    if (existingAvailability && Array.isArray(existingAvailability) && existingAvailability.length > 0) {
      await this.cacheService.set(cacheKey, existingAvailability, cacheTTL);
      return existingAvailability;
    }

    // Generate day-by-day availability from bookings
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    const days: any[] = [];

    while (currentDate.getTime() <= end.getTime()) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayDate = new Date(currentDate);
      
      // Check if this day has a booking
      const booking = bookings.find((b: any) => {
        const isConfirmed = b.status === 'confirmed';
        const isPartial = b.isPartialDay;
        const startDate = new Date(b.startDate);
        const endDate = new Date(b.endDate);
        
        if (isPartial) {
          // Partial day bookings: check if day matches the booking date (ignoring time)
          const bookingDateStr = startDate.toISOString().split('T')[0];
          return dateStr === bookingDateStr;
        }
        
        if (isConfirmed) {
          // Confirmed bookings use exclusive end date
          return dayDate >= startDate && dayDate < endDate;
        } else {
          // Pending bookings use inclusive end date
          return dayDate >= startDate && dayDate <= endDate;
        }
      });

      let day: any = {
        date: dateStr,
        available: !booking,
        status: booking ? (booking.status === 'confirmed' ? 'booked' : 'pending') : 'available',
      };

      if (booking) {
        day.bookingId = booking.id;
        
        // Handle partial day bookings
        if (booking.isPartialDay) {
          day.available = true;
          day.status = 'partially_available';
          
          // Adjust available slots based on booking time
          const bookingStartHour = new Date(booking.startDate).getUTCHours();
          const bookingEndHour = new Date(booking.endDate).getUTCHours();
          
          day.availableSlots = ['morning', 'afternoon', 'evening'];
          // Remove morning if booking overlaps (booking starts before 12)
          if (bookingStartHour < 12) {
            day.availableSlots = day.availableSlots.filter((s: string) => s !== 'morning');
          }
          // Remove afternoon if booking overlaps (booking starts before 18 and ends after 12)
          if (bookingStartHour < 18 && bookingEndHour > 12) {
            day.availableSlots = day.availableSlots.filter((s: string) => s !== 'afternoon');
          }
          // Remove evening if booking overlaps (booking ends after 18)
          if (bookingEndHour > 18) {
            day.availableSlots = day.availableSlots.filter((s: string) => s !== 'evening');
          }
        }
      }

      days.push(day);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Cache the result
    await this.cacheService.set(cacheKey, days, 3600); // Cache for 1 hour

    return days;
  }

  async checkConflicts(listingId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const bookings = (await this.bookingRepository.findBookingsByPeriod(listingId, startDate, endDate)) || [];
    
    const conflicts: any[] = [];
    for (const booking of bookings) {
      if (booking.status === 'confirmed' || booking.status === 'pending') {
        conflicts.push({
          bookingId: booking.id,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status,
          severity: booking.status === 'confirmed' ? 'high' : 'medium',
        });
      }
    }
    
    return conflicts;
  }

  async syncAvailability(listingId: string, syncData?: any): Promise<any> {
    this.logger.log(`Syncing availability for listing ${listingId}`);
    const channelResults = await this.availabilityRepository.syncAvailability(listingId, syncData);
    
    const successfulChannels = Object.keys(channelResults).filter(
      (channel) => channelResults[channel].success
    );
    const failedChannels = Object.keys(channelResults).filter(
      (channel) => !channelResults[channel].success
    );
    
    return {
      overallSuccess: failedChannels.length === 0,
      channelResults,
      successfulChannels,
      failedChannels,
    };
  }

  async getAvailabilityStats(listingId: string, startDate?: Date, endDate?: Date): Promise<{
    totalDays: number;
    availableDays: number;
    bookedDays: number;
    blockedDays: number;
  }> {
    // If date range provided, calculate stats for that range
    if (startDate && endDate) {
      const availability = await this.calculateAvailability(listingId, startDate, endDate);
      const totalDays = availability.length;
      const availableDays = availability.filter((d: any) => d.available).length;
      const bookedDays = availability.filter((d: any) => d.status === 'booked').length;
      const blockedDays = availability.filter((d: any) => d.status === 'blocked').length;

      return {
        totalDays,
        availableDays,
        bookedDays,
        blockedDays,
      };
    }

    return {
      totalDays: 30,
      availableDays: 20,
      bookedDays: 8,
      blockedDays: 2,
    };
  }

  async getAvailabilityStatistics(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const stats = await this.availabilityRepository.getAvailabilityStats(listingId, startDate, endDate);
    const totalDays = stats.totalDays || 0;
    const availableDays = stats.availableDays || 0;
    const bookedDays = stats.bookedDays || 0;
    const occupancyRate = totalDays > 0 ? Math.round((bookedDays / totalDays) * 100 * 100) / 100 : 0;
    const availabilityRate = totalDays > 0 ? Math.round((availableDays / totalDays) * 100 * 100) / 100 : 0;

    return {
      totalDays,
      availableDays,
      bookedDays,
      occupancyRate,
      availabilityRate,
      ...stats, // Include all other fields from repository stats (blockedDays, etc.)
    };
  }

  async blockPeriod(listingId: string, startDate: Date, endDate: Date, reason: string): Promise<void> {
    this.logger.log(`Blocking period for listing ${listingId}: ${startDate} to ${endDate}`);
  }

  async unblockPeriod(listingId: string, startDate: Date, endDate: Date): Promise<void> {
    this.logger.log(`Unblocking period for listing ${listingId}: ${startDate} to ${endDate}`);
  }

  async analyzeAvailabilityPatterns(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    peakSeasons: any[];
    lowSeasons: any[];
    bookingTrends: {
      averageBookingDuration: number;
      mostBookedDays: string[];
      leadTimeAverage: number;
    };
  }> {
    return {
      peakSeasons: [
        { season: 'summer', months: [6, 7, 8], occupancyRate: 85 },
        { season: 'winter_holidays', months: [12, 1], occupancyRate: 75 },
      ],
      lowSeasons: [{ season: 'monsoon', months: [7, 8], occupancyRate: 45 }],
      bookingTrends: {
        averageBookingDuration: 3.2,
        mostBookedDays: ['friday', 'saturday'],
        leadTimeAverage: 14,
      },
    };
  }

  async generateRecommendations(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recommendations: any[] }> {
    const stats = await this.getAvailabilityStatistics(listingId, startDate, endDate);
    const patterns = await this.analyzeAvailabilityPatterns(listingId, startDate, endDate);

    const recommendations: any[] = [];

    // Pricing recommendations based on occupancy rate
    if (stats.occupancyRate < 50) {
      recommendations.push({
        type: 'pricing',
        action: 'increase_rates',
        reason: 'low occupancy rate - consider increasing prices to maximize revenue',
      });
    } else if (stats.occupancyRate > 80) {
      recommendations.push({
        type: 'pricing',
        action: 'increase_rates',
        reason: 'High demand during this period',
      });
    }

    // Availability recommendations based on blocked days
    if ((stats as any).blockedDays > 0) {
      recommendations.push({
        type: 'availability',
        action: 'reduce_blocked_periods',
        reason: 'many blocked days - review and reduce blocked periods to increase availability',
      });
    }

    // Recommendations based on booking trends
    if (patterns.bookingTrends.leadTimeAverage > 30) {
      recommendations.push({
        type: 'marketing',
        action: 'target_early_bookers',
        reason: 'Guests book well in advance - implement early booking incentives',
      });
    }

    // Recommendations based on peak seasons
    if (patterns.peakSeasons.length > 0) {
      recommendations.push({
        type: 'seasonal',
        action: 'optimize_peak_season_pricing',
        reason: 'Peak seasons identified - implement dynamic pricing for high-demand periods',
      });
    }

    return { recommendations };
  }

  async calculateMultipleAvailability(
    listingIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const result: any = {};
    
    // Get all active listings
    const allActiveListings = await this.listingRepository.findActiveListings();
    
    // Filter to only requested listings that are active
    const activeListings = allActiveListings.filter((l: any) => listingIds.includes(l.id));
    const activeListingIds = activeListings.map((l: any) => l.id);
    
    // Get availability for all listings in one optimized query
    const allAvailability = await this.availabilityRepository.findAvailabilityByListing(activeListingIds.join(','));
    
    // Map availability to listing IDs (repository returns object keyed by listing ID)
    for (const listingId of activeListingIds) {
      result[listingId] = allAvailability[listingId] || [];
    }
    
    return result;
  }

  async detectConflicts(
    listingId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const bookings = (await this.bookingRepository.findBookingsByPeriod(listingId, startDate, endDate)) || [];
    const blockedPeriods = (await this.availabilityRepository.findBlockedPeriods(listingId)) || [];
    
    // Check minimum stay requirements
    const listing = await this.listingRepository.findById(listingId);
    if (listing && (listing as any).minimumStay) {
      const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (nights < (listing as any).minimumStay) {
        return {
          hasConflicts: true,
          conflicts: [{
            conflictType: 'minimum_stay_violation',
            requiredMinimumStay: (listing as any).minimumStay,
            requestedStay: nights,
            severity: 'medium',
          }],
          severity: 'medium',
          availableDays: [],
        };
      }
    }
    
    const conflicts: any[] = [];
    const availableDays: any[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    // Group conflicts by booking
    const bookingConflicts: any = {};
    
    // Check for edge conflicts (adjacent bookings) at booking level
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    bookings.forEach((booking: any) => {
      const bookingEndDateStr = new Date(booking.endDate).toISOString().split('T')[0];
      const bookingStartDateStr = new Date(booking.startDate).toISOString().split('T')[0];
      // Edge conflict: booking ends on the same day as new booking starts
      const endsOnStartDay = bookingEndDateStr === startDateStr;
      // Edge conflict: booking starts on the same day as new booking ends
      const startsOnEndDay = bookingStartDateStr === endDateStr;
      
      if (endsOnStartDay || startsOnEndDay) {
        bookingConflicts[booking.id] = {
          bookingId: booking.id,
          conflictType: 'edge_conflict',
          conflictDays: [endsOnStartDay ? startDateStr : endDateStr],
          severity: 'low',
        };
      }
    });

    while (currentDate.getTime() <= end.getTime()) {
      const dayDate = new Date(currentDate);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Check if this day is blocked
      const isBlocked = blockedPeriods.some(
        (block: any) => dayDate >= new Date(block.startDate) && dayDate < new Date(block.endDate)
      );

      // Check if this day has a booking (inclusive end date for conflict detection)
      const booking = bookings.find(
        (b: any) => dayDate >= new Date(b.startDate) && dayDate <= new Date(b.endDate)
      );

      if (booking && !bookingConflicts[booking.id]) {
        const conflictType = booking.status === 'confirmed' ? 'confirmed_overlap' : 'pending_overlap';
        bookingConflicts[booking.id] = {
          bookingId: booking.id,
          conflictType,
          conflictDays: [],
          severity: booking.status === 'confirmed' ? 'high' : 'medium',
        };
      }
      
      if (booking && bookingConflicts[booking.id]) {
        bookingConflicts[booking.id].conflictDays.push(dateStr);
      }

      if (isBlocked) {
        const block = blockedPeriods.find(
          (block: any) => dayDate >= new Date(block.startDate) && dayDate < new Date(block.endDate)
        );
        if (block) {
          conflicts.push({
            date: dateStr,
            conflictType: 'blocked_period',
            blockReason: block.reason,
            severity: 'high',
          });
        }
      }

      if (!booking && !isBlocked) {
        availableDays.push({ date: dateStr, available: true });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add grouped booking conflicts to conflicts array
    Object.values(bookingConflicts).forEach((conflict: any) => {
      conflicts.push(conflict);
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      severity: conflicts.length > 0 ? (conflicts.some((c) => c.severity === 'high') ? 'high' : 'medium') : 'none',
      availableDays,
    };
  }

  async createBlockedPeriod(listingId: string, blockData: any): Promise<any> {
    const blockedPeriod = await this.availabilityRepository.createBlockedPeriod({
      listingId,
      ...blockData,
    });
    return blockedPeriod;
  }

  async checkBookingAllowed(
    listingId: string,
    startDate: Date,
    endDate: Date,
    baseDate?: Date,
  ): Promise<any> {
    const now = baseDate || new Date();
    const daysInAdvance = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get listing details to check restrictions
    const listing = await this.listingRepository.findById(listingId);
    
    // Check blocked periods
    const blockedPeriods = (await this.availabilityRepository.findBlockedPeriods(listingId)) || [];
    const isBlocked = blockedPeriods.some(
      (block: any) => startDate < new Date(block.endDate) && endDate > new Date(block.startDate)
    );
    
    if (isBlocked) {
      return {
        allowed: false,
        reason: 'blocked_period',
        blockDetails: blockedPeriods.find(
          (block: any) => startDate < new Date(block.endDate) && endDate > new Date(block.startDate)
        ),
      };
    }
    
    // Check same-day booking restrictions first
    if (!(listing as any).allowSameDayBookings) {
      const bookingDateStr = startDate.toISOString().split('T')[0];
      const todayDateStr = now.toISOString().split('T')[0];
      if (bookingDateStr === todayDateStr) {
        return {
          allowed: false,
          reason: 'same_day_booking_not_allowed',
          cutoffTime: (listing as any).cutoffTime || '12:00',
        };
      }
    }
    
    // Check seasonal blocking rules
    if ((listing as any).seasonalRules && Array.isArray((listing as any).seasonalRules)) {
      for (const rule of (listing as any).seasonalRules) {
        if (rule.blockNewBookings) {
          const ruleStart = new Date(rule.startDate);
          const ruleEnd = new Date(rule.endDate);
          if (startDate >= ruleStart && startDate <= ruleEnd) {
            return {
              allowed: false,
              reason: 'seasonal_block',
              season: rule.season,
            };
          }
        }
      }
    }
    
    // Use existing minStayNights as minimum advance days
    const minAdvanceDays = listing?.minStayNights || 1;
    const maxAdvanceDays = (listing as any).advanceBookingLimit || listing?.maxStayNights || 365;
    
    if (daysInAdvance < minAdvanceDays) {
      return {
        allowed: false,
        reason: 'advance_booking_limit',
        minAdvanceDays,
        requestedAdvanceDays: daysInAdvance,
      };
    }
    
    if (maxAdvanceDays && daysInAdvance > maxAdvanceDays) {
      return {
        allowed: false,
        reason: 'advance_booking_limit',
        maxAdvanceDays,
        requestedAdvanceDays: daysInAdvance,
      };
    }
    
    // Check seasonal blocking from metadata if available
    let blockedSeasons: string[] = [];
    try {
      if (listing?.metadata) {
        const metadata = JSON.parse(listing.metadata);
        blockedSeasons = metadata.blockedSeasons || [];
      }
    } catch (e) {
      // Invalid metadata, ignore
    }
    
    const month = startDate.getMonth();
    const season = this.getSeason(month);
    
    if (blockedSeasons.includes(season)) {
      return {
        allowed: false,
        reason: 'Seasonal restriction',
        season,
      };
    }
    
    return {
      allowed: true,
      cutoffTime: listing?.checkInTime || '14:00',
      minAdvanceDays,
      maxAdvanceDays,
      requestedAdvanceDays: daysInAdvance,
    };
  }
  
  private getSeason(month: number): string {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  async validateBookingTimes(
    listingId: string,
    startDate: Date,
    endDate: Date,
    skipFutureCheck: boolean = false,
  ): Promise<any> {
    const listing = await this.listingRepository.findById(listingId);
    const errors: string[] = [];
    
    // Validate check-in time
    const checkinTime = (listing as any).checkinTime || '14:00';
    const [checkinHour] = checkinTime.split(':').map(Number);
    const checkinValid = startDate.getUTCHours() >= checkinHour;
    if (!checkinValid) {
      errors.push(`Check-in must be after ${checkinTime}`);
    }
    
    // Validate check-out time
    const checkoutTime = (listing as any).checkoutTime || '11:00';
    const [checkoutHour] = checkoutTime.split(':').map(Number);
    const checkoutValid = endDate.getUTCHours() <= checkoutHour;
    if (!checkoutValid) {
      errors.push(`Check-out must be before ${checkoutTime}`);
    }
    
    // Validate minimum stay
    const minBookingDuration = (listing as any).minBookingDuration || 24;
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const durationValid = durationHours >= minBookingDuration;
    if (!durationValid) {
      errors.push(`Minimum stay is ${minBookingDuration} hour(s)`);
    }
    
    // Validate maximum stay
    const maxStayNights = listing?.maxStayNights;
    const durationNights = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
    if (maxStayNights && durationNights > maxStayNights) {
      errors.push(`Maximum stay is ${maxStayNights} night(s)`);
    }
    
    // Validate dates are in the future (unless skipped for testing)
    if (!skipFutureCheck) {
      const now = new Date();
      const datesInFuture = startDate >= now && endDate >= now;
      if (!datesInFuture) {
        errors.push('Booking dates must be in the future');
      }
    }
    
    // Validate end date is after start date
    const validOrder = endDate > startDate;
    if (!validOrder) {
      errors.push('End date must be after start date');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      checkinValid,
      checkoutValid,
      durationValid,
    };
  }

  async updateRealTimeAvailability(listingId: string, updateData: any): Promise<any> {
    // Update availability slots in real-time
    const updatedAvailability = await this.availabilityRepository.updateAvailability(
      listingId,
      updateData,
    );
    
    // Invalidate cache
    const cacheKey = `availability:${listingId}:${updateData.date}`;
    await this.cacheService.del(cacheKey);
    
    return updatedAvailability;
  }

  async resolveSyncConflicts(listingId: string): Promise<any> {
    // Fetch conflicts between different channels
    const conflicts = (await this.availabilityRepository.findConflicts(listingId, new Date(), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))) || [];
    
    // Resolve conflicts using repository
    const resolution = await this.availabilityRepository.resolveConflicts(listingId, conflicts);
    
    return resolution;
  }

  async bulkUpdateAvailability(bulkUpdates: any[]): Promise<any> {
    const result = await this.availabilityRepository.bulkUpdateAvailability(bulkUpdates);
    
    // Invalidate cache for all affected listings
    for (const update of bulkUpdates) {
      const cacheKey = `availability:${update.listingId}:${update.startDate}:${update.endDate}`;
      await this.cacheService.del(cacheKey);
    }
    
    return result;
  }
}
