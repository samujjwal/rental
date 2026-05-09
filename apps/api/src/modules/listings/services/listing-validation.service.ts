import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CategoryTemplateService } from '@/modules/categories/services/category-template.service';
import { CategoryAttributeService } from '@/modules/categories/services/category-attribute.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

@Injectable()
export class ListingValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: CategoryTemplateService,
    private readonly attributeService: CategoryAttributeService,
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

    // First, try to validate using server-defined dynamic attributes
    const attributeDefinitions = await this.attributeService.findDefinitionsByCategory(categoryId);
    
    if (attributeDefinitions.length > 0) {
      return this.validateAgainstAttributeDefinitions(data, attributeDefinitions);
    }

    // Fallback to template-based validation for backward compatibility
    const template = this.templateService.getTemplate(category.slug);
    if (!template) {
      return {
        isValid: false,
        errors: ['Category template not found'],
      };
    }

    return this.templateService.validateData(category.slug, data);
  }

  private validateAgainstAttributeDefinitions(
    data: Record<string, any>,
    attributeDefinitions: any[],
  ): ValidationResult {
    const errors: string[] = [];

    for (const definition of attributeDefinitions) {
      const value = data[definition.slug];

      // Check required fields
      if (definition.isRequired && (value === undefined || value === null || value === '')) {
        errors.push(`Field '${definition.label}' is required`);
        continue;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Validate based on field type using CategoryAttributeService's validation
      try {
        (this.attributeService as any).validateValue(value, definition);
      } catch (error: any) {
        errors.push(error.message || `Invalid value for '${definition.label}'`);
      }
    }

    // Check for unknown fields (fields not defined in attribute definitions)
    const definedSlugs = new Set(attributeDefinitions.map((d) => d.slug));
    const unknownFields = Object.keys(data).filter((key) => !definedSlugs.has(key));
    
    if (unknownFields.length > 0) {
      errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validatePricingConfiguration(dto: any): ValidationResult {
    const errors: string[] = [];

    if (dto.basePrice !== undefined && dto.basePrice < 0) {
      errors.push('Base price cannot be negative');
    }

    if (dto.minBookingHours !== undefined && dto.minBookingHours < 0) {
      errors.push('Minimum booking hours cannot be negative');
    }

    if (dto.maxBookingDays !== undefined && dto.maxBookingDays < 0) {
      errors.push('Maximum booking days cannot be negative');
    }

    if (dto.leadTime !== undefined && dto.leadTime < 0) {
      errors.push('Lead time cannot be negative');
    }

    if (dto.advanceNotice !== undefined && dto.advanceNotice < 0) {
      errors.push('Advance notice cannot be negative');
    }

    if (dto.capacity !== undefined && dto.capacity < 1) {
      errors.push('Capacity must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  validatePropertyCompleteness(listing: any): ValidationResult {
    const errors: string[] = [];

    if (!listing.title || listing.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!listing.description || listing.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!listing.basePrice || listing.basePrice < 0) {
      errors.push('Base price is required and must be non-negative');
    }

    if (!listing.city || listing.city.trim().length === 0) {
      errors.push('City is required');
    }

    if (!listing.state || listing.state.trim().length === 0) {
      errors.push('State is required');
    }

    if (!listing.country || listing.country.trim().length === 0) {
      errors.push('Country is required');
    }

    if (!listing.categoryId) {
      errors.push('Category is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
