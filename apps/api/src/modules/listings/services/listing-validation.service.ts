import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';
import { Listing, toNumber } from '@rental-portal/database';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class PropertyValidationService {
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

  validatePropertyCompleteness(listing: Listing): ValidationResult {
    const errors: string[] = [];

    // Required basic fields
    if (!listing.title || listing.title.length < 10) {
      errors.push('Title must be at least 10 characters long');
    }

    if (!listing.description || listing.description.length < 50) {
      errors.push('Description must be at least 50 characters long');
    }

    // Location
    if (!listing.address || !listing.city || !listing.country) {
      errors.push('Complete address information is required');
    }

    // Photos
    if (!listing.photos || listing.photos.length === 0) {
      errors.push('At least one photo is required');
    }

    // Pricing
    if (!listing.basePrice || toNumber(listing.basePrice) <= 0) {
      errors.push('Base price must be greater than zero');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate pricing configuration for a listing.
   * Checks that prices are positive and pricing mode is consistent.
   */
  validatePricingConfiguration(listing: Partial<Listing>): ValidationResult {
    const errors: string[] = [];

    if (listing.basePrice !== undefined && listing.basePrice !== null) {
      const price = toNumber(listing.basePrice);
      if (price < 0) {
        errors.push('Base price cannot be negative');
      }
    }

    // Check that at least one price is set
    const hasAnyPrice = [
      listing.basePrice,
      (listing as any).hourlyPrice,
      (listing as any).dailyPrice,
      (listing as any).weeklyPrice,
      (listing as any).monthlyPrice,
    ].some((p) => p !== undefined && p !== null && toNumber(p) > 0);

    if (!hasAnyPrice && listing.basePrice === undefined) {
      errors.push('At least one pricing tier must be set');
    }

    // Validate deposit configuration
    const requiresDeposit = (listing as any).requiresDeposit;
    const depositAmount = (listing as any).depositAmount;
    if (requiresDeposit && (!depositAmount || toNumber(depositAmount) <= 0)) {
      errors.push('Deposit amount must be positive when deposit is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate booking configuration for a listing.
   * Checks min/max booking duration and booking mode settings.
   */
  validateBookingConfiguration(listing: Partial<Listing>): ValidationResult {
    const errors: string[] = [];

    const minHours = (listing as any).minBookingHours;
    const maxDays = (listing as any).maxBookingDays;

    if (minHours !== undefined && minHours < 1) {
      errors.push('Minimum booking duration must be at least 1 hour');
    }

    if (maxDays !== undefined && maxDays < 1) {
      errors.push('Maximum booking duration must be at least 1 day');
    }

    if (minHours !== undefined && maxDays !== undefined) {
      const maxHours = maxDays * 24;
      if (minHours > maxHours) {
        errors.push('Minimum booking hours cannot exceed maximum booking days');
      }
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

// Export alias for backward compatibility with tests
export const ListingValidationService = PropertyValidationService;
