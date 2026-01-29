import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CategoryTemplateService } from '../../categories/services/category-template.service';
import { Property, toNumber } from '@rental-portal/database';

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

  validatePropertyCompleteness(listing: Property): ValidationResult {
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

  // Skip pricing validation - fields don't exist in Property schema
  validatePricingConfiguration(listing: Partial<Property>): ValidationResult {
    return { isValid: true, errors: [] };
  }

  // Skip booking validation - fields don't exist in Property schema
  validateBookingConfiguration(listing: Partial<Property>): ValidationResult {
    return { isValid: true, errors: [] };
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
