import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';
import { Listing } from '@rental-portal/database';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class ListingValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: CategoryTemplateService,
  ) {}

  async validateCategoryData(
    categoryId: string,
    data: Record<string, any>,
  ): Promise<ValidationResult> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return {
        isValid: false,
        errors: ['Category not found'],
      };
    }

    const template = this.templateService.getTemplate(category.slug);
    if (!template) {
      return {
        isValid: false,
        errors: ['Category template not found'],
      };
    }

    return this.templateService.validateData(category.slug, data);
  }

  validateListingCompleteness(listing: Listing): ValidationResult {
    const errors: string[] = [];

    // Required basic fields
    if (!listing.title || listing.title.length < 10) {
      errors.push('Title must be at least 10 characters long');
    }

    if (!listing.description || listing.description.length < 50) {
      errors.push('Description must be at least 50 characters long');
    }

    // Location
    if (!listing.city || !listing.country) {
      errors.push('City and country are required');
    }

    if (!listing.latitude || !listing.longitude) {
      errors.push('Location coordinates are required');
    }

    // Photos
    const photos = listing.photos as any[];
    if (!photos || photos.length === 0) {
      errors.push('At least one photo is required');
    }

    // Pricing
    if (listing.basePrice <= 0) {
      errors.push('Base price must be greater than zero');
    }

    // Booking settings
    if (!listing.bookingMode) {
      errors.push('Booking mode is required');
    }

    if (listing.bookingMode === 'REQUEST_TO_BOOK' && !listing.leadTime) {
      errors.push('Lead time is required for request booking mode');
    }

    // Category-specific data
    if (!listing.categorySpecificData || Object.keys(listing.categorySpecificData).length === 0) {
      errors.push('Category-specific information is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validatePricingConfiguration(listing: Partial<Listing>): ValidationResult {
    const errors: string[] = [];

    if (!listing.pricingMode) {
      errors.push('Pricing mode is required');
    }

    if (!listing.basePrice || listing.basePrice <= 0) {
      errors.push('Base price must be greater than zero');
    }

    // Validate pricing mode specific requirements
    if (listing.pricingMode === 'PER_HOUR' && !listing.hourlyPrice) {
      errors.push('Hourly price is required for hourly pricing mode');
    }

    if (listing.pricingMode === 'PER_DAY' && !listing.dailyPrice) {
      errors.push('Daily price is required for daily pricing mode');
    }

    // Validate deposit settings
    if (listing.requiresDeposit) {
      if (!listing.depositAmount || listing.depositAmount <= 0) {
        errors.push('Deposit amount must be greater than zero when deposit is required');
      }

      if (!listing.depositType) {
        errors.push('Deposit type is required when deposit is required');
      }
    }

    // Validate price relationships
    if (
      listing.weeklyPrice &&
      listing.dailyPrice &&
      listing.weeklyPrice >= listing.dailyPrice * 7
    ) {
      errors.push('Weekly price should be less than 7 times the daily price');
    }

    if (
      listing.monthlyPrice &&
      listing.dailyPrice &&
      listing.monthlyPrice >= listing.dailyPrice * 30
    ) {
      errors.push('Monthly price should be less than 30 times the daily price');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validateBookingConfiguration(listing: Partial<Listing>): ValidationResult {
    const errors: string[] = [];

    if (!listing.bookingMode) {
      errors.push('Booking mode is required');
    }

    if (listing.minBookingHours && listing.minBookingHours < 1) {
      errors.push('Minimum booking hours must be at least 1');
    }

    if (listing.maxBookingDays && listing.maxBookingDays < 1) {
      errors.push('Maximum booking days must be at least 1');
    }

    if (listing.minBookingHours && listing.maxBookingDays) {
      const maxHours = listing.maxBookingDays * 24;
      if (listing.minBookingHours > maxHours) {
        errors.push('Minimum booking hours cannot exceed maximum booking days');
      }
    }

    if (listing.leadTime !== undefined && listing.leadTime < 0) {
      errors.push('Lead time cannot be negative');
    }

    if (listing.advanceNotice !== undefined && listing.advanceNotice < 0) {
      errors.push('Advance notice cannot be negative');
    }

    if (listing.capacity && listing.capacity < 1) {
      errors.push('Capacity must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validatePhotoUrls(
    photos: Array<{ url: string; order: number; caption?: string }>,
  ): ValidationResult {
    const errors: string[] = [];

    if (!photos || photos.length === 0) {
      errors.push('At least one photo is required');
    }

    const orders = new Set<number>();
    for (const photo of photos) {
      if (!photo.url || !photo.url.startsWith('http')) {
        errors.push(`Invalid photo URL: ${photo.url}`);
      }

      if (photo.order < 0) {
        errors.push('Photo order must be non-negative');
      }

      if (orders.has(photo.order)) {
        errors.push(`Duplicate photo order: ${photo.order}`);
      }
      orders.add(photo.order);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
